import { logger } from "@/lib/logger"

const BASE = "https://open.feishu.cn/open-apis"

interface FunnelNumbers {
  totalApplications: number
  passedScreening: number
  passedBusinessReview: number
  interviewAttendees: number
  offersSent: number
  offersAccepted: number
  onboarded: number
  note?: string
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
  return {
    日期: dateMs,
    简历投递量: f.totalApplications,
    初筛通过: f.passedScreening,
    业务筛选通过: f.passedBusinessReview,
    面试到场: f.interviewAttendees,
    Offer发出: f.offersSent,
    Offer接受: f.offersAccepted,
    入职: f.onboarded,
    初筛通过率: safeRate(f.passedScreening, f.totalApplications),
    业务筛选通过率: safeRate(f.passedBusinessReview, f.passedScreening),
    面试到场率: safeRate(f.interviewAttendees, f.passedBusinessReview),
    Offer发出率: safeRate(f.offersSent, f.interviewAttendees),
    Offer接受率: safeRate(f.offersAccepted, f.offersSent),
    入职率: safeRate(f.onboarded, f.offersAccepted),
    备注: f.note ?? "",
  }
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
    const dateMs = new Date(date).setHours(0, 0, 0, 0)
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
