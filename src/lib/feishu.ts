import { logger } from "@/lib/logger"
import { prisma } from "@/lib/prisma"
import type { TodoItem } from "@/lib/recruitment-todos"

const BASE = "https://open.feishu.cn/open-apis"

// Candidate board lives in the same Bitable base as the funnel table.
// The table id is stable, so default to it when the env var is unset
// (avoids requiring an extra Vercel env var for this single-tenant app).
const CANDIDATE_TABLE_ID = process.env.FEISHU_CANDIDATE_TABLE_ID || "tblV49gshqS0AWoc"
// 今日To-do 表 (same Bitable base). Auto-filled by the daily cron.
const TODO_TABLE_ID = process.env.FEISHU_TODO_TABLE_ID || "tblssZXP1mW0DRjl"

interface FunnelNumbers {
  totalApplications: number
  passedScreening: number
  passedBusinessReview: number
  interviewInvited: number
  interviewAttendees: number
  offersSent: number
  offersAccepted: number
  onboarded: number
  note?: string
  // Per-stage candidate name lists (optional; omitted fields are left untouched in Feishu)
  screeningList?: string
  invitedList?: string
  interviewedList?: string
  offerList?: string
  inProcessList?: string
}

let cachedToken: { value: string; expiresAt: number } | null = null

function isConfigured(): boolean {
  return Boolean(
    process.env.FEISHU_APP_ID &&
      process.env.FEISHU_APP_SECRET &&
      process.env.FEISHU_BITABLE_APP_TOKEN &&
      process.env.FEISHU_BITABLE_TABLE_ID
  )
}

// ── Beijing timezone helpers (server-TZ independent) ──
function beijingYmd(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" })
}
export function beijingMidnightMs(date: Date): number {
  return new Date(`${beijingYmd(date)}T00:00:00+08:00`).getTime()
}
function candidatesConfigured(): boolean {
  return Boolean(
    process.env.FEISHU_APP_ID &&
      process.env.FEISHU_APP_SECRET &&
      process.env.FEISHU_BITABLE_APP_TOKEN &&
      CANDIDATE_TABLE_ID
  )
}

async function getToken(): Promise<string | null> {
  if (!isConfigured()) return null
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value
  }

  const res = await fetch(`${BASE}/auth/v3/tenant_access_token/internal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      app_id: process.env.FEISHU_APP_ID,
      app_secret: process.env.FEISHU_APP_SECRET,
    }),
  })
  const data = (await res.json()) as {
    code: number
    tenant_access_token?: string
    expire?: number
  }
  if (data.code !== 0 || !data.tenant_access_token) {
    logger.error("Feishu token failed", { code: data.code })
    return null
  }
  cachedToken = {
    value: data.tenant_access_token,
    expiresAt: Date.now() + (data.expire ?? 7200) * 1000,
  }
  return cachedToken.value
}

function safeRate(numerator: number, denominator: number): number {
  if (!denominator || denominator <= 0) return 0
  return numerator / denominator
}

function buildFields(f: FunnelNumbers, dateMs: number): Record<string, unknown> {
  const fields: Record<string, unknown> = {
    日期: dateMs,
    简历投递量: f.totalApplications,
    初筛通过: f.passedScreening,
    业务筛选通过: f.passedBusinessReview,
    邀约面试: f.interviewInvited,
    面试到场: f.interviewAttendees,
    Offer发出: f.offersSent,
    Offer接受: f.offersAccepted,
    入职: f.onboarded,
    初筛通过率: safeRate(f.passedScreening, f.totalApplications),
    业务筛选通过率: safeRate(f.passedBusinessReview, f.passedScreening),
    邀约率: safeRate(f.interviewInvited, f.passedBusinessReview),
    面试到场率: safeRate(f.interviewAttendees, f.interviewInvited),
    Offer发出率: safeRate(f.offersSent, f.interviewAttendees),
    Offer接受率: safeRate(f.offersAccepted, f.offersSent),
    入职率: safeRate(f.onboarded, f.offersAccepted),
  }
  if (f.note !== undefined) fields["备注"] = f.note
  if (f.screeningList !== undefined) fields["初筛名单"] = f.screeningList
  if (f.invitedList !== undefined) fields["邀约名单"] = f.invitedList
  if (f.interviewedList !== undefined) fields["面试名单"] = f.interviewedList
  if (f.offerList !== undefined) fields["Offer名单"] = f.offerList
  if (f.inProcessList !== undefined) fields["流程中"] = f.inProcessList
  return fields
}

async function findRecordByDate(
  token: string,
  appToken: string,
  tableId: string,
  dateMs: number
): Promise<string | null> {
  const res = await fetch(
    `${BASE}/bitable/v1/apps/${appToken}/tables/${tableId}/records/search`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filter: {
          conjunction: "and",
          conditions: [
            {
              field_name: "日期",
              operator: "is",
              value: ["ExactDate", String(dateMs)],
            },
          ],
        },
      }),
    }
  )
  const data = (await res.json()) as {
    code: number
    data?: { items?: { record_id: string }[] }
  }
  if (data.code !== 0) return null
  return data.data?.items?.[0]?.record_id ?? null
}

/**
 * Upsert one day of recruitment funnel data into the Feishu Bitable.
 * Non-critical: logs and swallows errors so it never breaks the caller.
 */
export async function syncFunnelToFeishu(
  date: Date,
  funnel: FunnelNumbers
): Promise<void> {
  try {
    const token = await getToken()
    if (!token) return

    const appToken = process.env.FEISHU_BITABLE_APP_TOKEN!
    const tableId = process.env.FEISHU_BITABLE_TABLE_ID!
    const dateMs = beijingMidnightMs(new Date(date))
    const fields = buildFields(funnel, dateMs)

    const existingId = await findRecordByDate(token, appToken, tableId, dateMs)

    if (existingId) {
      await fetch(
        `${BASE}/bitable/v1/apps/${appToken}/tables/${tableId}/records/${existingId}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ fields }),
        }
      )
    } else {
      await fetch(
        `${BASE}/bitable/v1/apps/${appToken}/tables/${tableId}/records`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ fields }),
        }
      )
    }
  } catch (e) {
    logger.error("Feishu funnel sync failed", { error: String(e) })
  }
}

// Feishu number fields may serialize as number or string.
function toNum(v: unknown): number {
  if (typeof v === "number") return v
  if (typeof v === "string") {
    const n = parseInt(v, 10)
    return isNaN(n) ? 0 : n
  }
  return 0
}

// Feishu text fields may serialize as string or array of {text} segments.
function toText(v: unknown): string {
  if (typeof v === "string") return v
  if (Array.isArray(v)) {
    return v
      .map((seg) => (typeof seg === "string" ? seg : (seg as { text?: string })?.text ?? ""))
      .join("")
  }
  if (v && typeof v === "object" && "text" in v) {
    return String((v as { text?: string }).text ?? "")
  }
  return ""
}

interface FeishuRecord {
  fields: Record<string, unknown>
}

/**
 * Pull all funnel rows from the Feishu Bitable and mirror them into the local DB
 * (Feishu is the source of truth). Rows absent from Feishu are removed locally.
 * Non-critical: on any failure it logs and leaves the local DB untouched.
 */
export async function pullFunnelFromFeishu(internshipId: string): Promise<void> {
  try {
    const token = await getToken()
    if (!token) return

    const appToken = process.env.FEISHU_BITABLE_APP_TOKEN!
    const tableId = process.env.FEISHU_BITABLE_TABLE_ID!

    const items: FeishuRecord[] = []
    let pageToken = ""
    for (let guard = 0; guard < 20; guard++) {
      const url = `${BASE}/bitable/v1/apps/${appToken}/tables/${tableId}/records?page_size=200${pageToken ? `&page_token=${pageToken}` : ""}`
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      const data = (await res.json()) as {
        code: number
        data?: { items?: FeishuRecord[]; page_token?: string; has_more?: boolean }
      }
      if (data.code !== 0) return
      items.push(...(data.data?.items ?? []))
      if (!data.data?.has_more || !data.data?.page_token) break
      pageToken = data.data.page_token
    }

    const keepDates: Date[] = []
    for (const it of items) {
      const f = it.fields
      const dmsRaw = f["日期"]
      const dms = typeof dmsRaw === "number" ? dmsRaw : Number(dmsRaw)
      if (!dms || isNaN(dms)) continue

      const normDate = new Date(beijingMidnightMs(new Date(dms)))
      keepDates.push(normDate)

      const stageDetail = JSON.stringify({
        screening: toText(f["推荐简历名单"]),
        business: toText(f["业务筛通过名单"]),
        invited: toText(f["邀约面试名单"]),
        interviewed: toText(f["面试通过"]),
        inProcess: toText(f["流程中/待谈薪"]),
      })
      const note = toText(f["备注"]) || null

      // Count non-empty name tokens; ignore bare numeric placeholders like "0".
      const countNames = (v: unknown): number => {
        const s = toText(v).trim()
        if (!s) return 0
        return s
          .split(/[、,，;；]/)
          .map((x) => x.trim())
          .filter((x) => x && !/^\d+$/.test(x)).length
      }

      const counts = {
        totalApplications: toNum(f["简历投递量"]),
        passedScreening: toNum(f["推荐简历"]),
        passedBusinessReview: toNum(f["业务筛选通过"]),
        interviewInvited: toNum(f["邀约面试"]),
        interviewAttendees: toNum(f["今日面试"]),
        offersSent: countNames(f["Offer名单"]),
        offersAccepted: 0,
        onboarded: countNames(f["待入职"]),
      }

      await prisma.recruitmentFunnel.upsert({
        where: { internshipId_date: { internshipId, date: normDate } },
        create: { internshipId, date: normDate, ...counts, stageDetail, note },
        update: { ...counts, stageDetail, note },
      })
    }

    // Feishu is source of truth: drop local rows no longer present in Feishu.
    if (keepDates.length > 0) {
      await prisma.recruitmentFunnel.deleteMany({
        where: { internshipId, date: { notIn: keepDates } },
      })
    }
  } catch (e) {
    logger.error("Feishu funnel pull failed", { error: String(e) })
  }
}

// ── Candidate board (候选人看板) ──

export interface CandidateFields {
  name: string
  position?: string | null
  currentStage: string
  recommendedDate?: Date | null
  businessPassDate?: Date | null
  interviewInviteDate?: Date | null
  interviewDate?: Date | null
  offerDate?: Date | null
  offerAcceptDate?: Date | null
  onboardDate?: Date | null
  interviewScheduledAt?: Date | null
  statusNote?: string | null
}

// Feishu date fields serialize as ms timestamps; normalize to Beijing midnight.
function toDate(v: unknown): Date | null {
  const ms = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN
  if (!ms || isNaN(ms)) return null
  return new Date(beijingMidnightMs(new Date(ms)))
}

// Like toDate but preserves the exact time (for scheduled datetimes).
function toDateTimeRaw(v: unknown): Date | null {
  const ms = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN
  if (!ms || isNaN(ms)) return null
  return new Date(ms)
}

function dateToMs(d: Date | null | undefined): number | undefined {
  if (!d) return undefined
  return beijingMidnightMs(new Date(d))
}

// Normalize a free-text position into one of the canonical single-select
// options so writes never create stray options in Feishu.
function normalizePosition(p: string | null | undefined): string {
  const s = (p ?? "").trim()
  if (!s) return ""
  if (s.includes("抽卡")) return "抽卡师"
  if (s.includes("编剧")) return "短剧编剧"
  if (s.includes("内容策划") || s.includes("内容策略")) return "内容策划运营"
  if (s.includes("审核")) return "剧本审核专员"
  if (s.includes("运营")) return "短剧运营"
  return s
}

function buildCandidateFields(c: CandidateFields): Record<string, unknown> {
  const fields: Record<string, unknown> = {
    姓名: c.name,
    当前阶段: c.currentStage,
  }
  if (c.position !== undefined) fields["岗位"] = normalizePosition(c.position)
  if (c.statusNote !== undefined) fields["状态备注"] = c.statusNote ?? ""
  // 约面时间 keeps the exact time (not day-normalized).
  if (c.interviewScheduledAt) fields["约面时间"] = new Date(c.interviewScheduledAt).getTime()
  const dateMap: [string, Date | null | undefined][] = [
    ["推荐日期", c.recommendedDate],
    ["业务筛选日期", c.businessPassDate],
    ["邀约日期", c.interviewInviteDate],
    ["面试日期", c.interviewDate],
    ["Offer日期", c.offerDate],
    ["接受日期", c.offerAcceptDate],
    ["入职日期", c.onboardDate],
  ]
  for (const [label, d] of dateMap) {
    const ms = dateToMs(d)
    if (ms !== undefined) fields[label] = ms
  }
  return fields
}

async function findCandidateRecordByName(
  token: string,
  appToken: string,
  tableId: string,
  name: string
): Promise<string | null> {
  const res = await fetch(
    `${BASE}/bitable/v1/apps/${appToken}/tables/${tableId}/records/search`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        filter: {
          conjunction: "and",
          conditions: [{ field_name: "姓名", operator: "is", value: [name] }],
        },
      }),
    }
  )
  const data = (await res.json()) as { code: number; data?: { items?: { record_id: string }[] } }
  if (data.code !== 0) return null
  return data.data?.items?.[0]?.record_id ?? null
}

/**
 * Upsert one candidate into the Feishu 候选人看板 table (keyed by 姓名).
 * Non-critical: logs and swallows errors.
 */
export async function syncCandidateToFeishu(c: CandidateFields): Promise<void> {
  try {
    if (!candidatesConfigured()) return
    const token = await getToken()
    if (!token) return
    const appToken = process.env.FEISHU_BITABLE_APP_TOKEN!
    const tableId = CANDIDATE_TABLE_ID
    const fields = buildCandidateFields(c)
    const existingId = await findCandidateRecordByName(token, appToken, tableId, c.name)
    if (existingId) {
      await fetch(`${BASE}/bitable/v1/apps/${appToken}/tables/${tableId}/records/${existingId}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ fields }),
      })
    } else {
      await fetch(`${BASE}/bitable/v1/apps/${appToken}/tables/${tableId}/records`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ fields }),
      })
    }
  } catch (e) {
    logger.error("Feishu candidate sync failed", { error: String(e) })
  }
}

/**
 * Pull all candidates from the Feishu 候选人看板 table into local DB
 * (Feishu is source of truth). Candidates absent from Feishu are removed locally.
 * Non-critical: on any failure it logs and leaves the local DB untouched.
 */
export async function pullCandidatesFromFeishu(internshipId: string): Promise<void> {
  try {
    if (!candidatesConfigured()) return
    const token = await getToken()
    if (!token) return
    const appToken = process.env.FEISHU_BITABLE_APP_TOKEN!
    const tableId = CANDIDATE_TABLE_ID

    const items: FeishuRecord[] = []
    let pageToken = ""
    for (let guard = 0; guard < 20; guard++) {
      const url = `${BASE}/bitable/v1/apps/${appToken}/tables/${tableId}/records?page_size=200${pageToken ? `&page_token=${pageToken}` : ""}`
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      const data = (await res.json()) as {
        code: number
        data?: { items?: FeishuRecord[]; page_token?: string; has_more?: boolean }
      }
      if (data.code !== 0) return
      items.push(...(data.data?.items ?? []))
      if (!data.data?.has_more || !data.data?.page_token) break
      pageToken = data.data.page_token
    }

    const keepNames: string[] = []
    for (const it of items) {
      const f = it.fields
      const name = toText(f["姓名"]).trim()
      if (!name) continue
      keepNames.push(name)

      const data = {
        position: toText(f["岗位"]) || null,
        currentStage: toText(f["当前阶段"]) || "推荐简历",
        recommendedDate: toDate(f["推荐日期"]),
        businessPassDate: toDate(f["业务筛选日期"]),
        interviewInviteDate: toDate(f["邀约日期"]),
        interviewDate: toDate(f["面试日期"]),
        offerDate: toDate(f["Offer日期"]),
        offerAcceptDate: toDate(f["接受日期"]),
        onboardDate: toDate(f["入职日期"]),
        interviewScheduledAt: toDateTimeRaw(f["约面时间"]),
        statusNote: toText(f["状态备注"]) || null,
        baseLocation: toText(f["base地"]) || null,
        subStatus: toText(f["子状态"]) || null,
      }

      await prisma.candidate.upsert({
        where: { internshipId_name: { internshipId, name } },
        create: { internshipId, name, ...data },
        update: data,
      })
    }

    // Feishu is source of truth: drop local candidates no longer present in Feishu.
    if (keepNames.length > 0) {
      await prisma.candidate.deleteMany({
        where: { internshipId, name: { notIn: keepNames } },
      })
    }
  } catch (e) {
    logger.error("Feishu candidate pull failed", { error: String(e) })
  }
}

/**
 * Overwrite today's auto-generated recruiting to-dos in the Feishu 今日To-do 表.
 * Only rows this cron generates (分类=招聘, same 日期) are cleared then rewritten,
 * so manually-added rows and other categories (e.g. 复盘) are left untouched.
 * Non-critical: logs and swallows errors so it never breaks the caller.
 */
export async function syncTodosToFeishu(dateMs: number, items: TodoItem[]): Promise<void> {
  try {
    const token = await getToken()
    if (!token) return
    const appToken = process.env.FEISHU_BITABLE_APP_TOKEN!
    const tableId = TODO_TABLE_ID

    // 1. Collect this date's stale auto rows (分类=招聘) and delete them.
    const staleIds: string[] = []
    let pageToken = ""
    for (let guard = 0; guard < 20; guard++) {
      const url = `${BASE}/bitable/v1/apps/${appToken}/tables/${tableId}/records?page_size=200${pageToken ? `&page_token=${pageToken}` : ""}`
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      const data = (await res.json()) as {
        code: number
        data?: { items?: { record_id: string; fields: Record<string, unknown> }[]; page_token?: string; has_more?: boolean }
      }
      if (data.code !== 0) break
      for (const it of data.data?.items ?? []) {
        const dRaw = it.fields["日期"]
        const d = typeof dRaw === "number" ? dRaw : Number(dRaw)
        if (!isNaN(d) && beijingMidnightMs(new Date(d)) === dateMs && toText(it.fields["分类"]) === "招聘") {
          staleIds.push(it.record_id)
        }
      }
      if (!data.data?.has_more || !data.data?.page_token) break
      pageToken = data.data.page_token
    }
    if (staleIds.length) {
      await fetch(`${BASE}/bitable/v1/apps/${appToken}/tables/${tableId}/records/batch_delete`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ records: staleIds }),
      })
    }

    // 2. Write the fresh to-dos for today.
    if (!items.length) return
    const records = items.map((t) => ({
      fields: {
        "任务": t.names.length ? `${t.label}（${t.names.length}人）` : t.label,
        "优先级": t.priority === "high" ? "高" : "中",
        "分类": "招聘",
        "状态": "待办",
        "日期": dateMs,
        "备注": [t.names.join("、"), t.hint].filter(Boolean).join(" · "),
      },
    }))
    await fetch(`${BASE}/bitable/v1/apps/${appToken}/tables/${tableId}/records/batch_create`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ records }),
    })
  } catch (e) {
    logger.error("Feishu todos sync failed", { error: String(e) })
  }
}
