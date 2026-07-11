import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { handleApiError, badRequest } from "@/lib/api-utils"
import { pullCandidatesFromFeishu, beijingMidnightMs } from "@/lib/feishu"

// Throttle Feishu pulls: at most one per internship per TTL window.
const lastPull = new Map<string, number>()
const PULL_TTL_MS = 30_000

export const STAGES = [
  { key: "totalApplications", label: "简历投递量", shortLabel: "投递" },
  { key: "passedScreening", label: "推荐简历", shortLabel: "推荐" },
  { key: "passedBusinessReview", label: "业务筛选通过", shortLabel: "业务筛选" },
  { key: "interviewInvited", label: "邀约面试", shortLabel: "邀约" },
  { key: "interviewAttendees", label: "面试到场", shortLabel: "面试" },
  { key: "offersSent", label: "Offer发出", shortLabel: "Offer" },
  { key: "offersAccepted", label: "Offer接受", shortLabel: "接受" },
  { key: "onboarded", label: "入职", shortLabel: "入职" },
] as const

type StageKey = (typeof STAGES)[number]["key"]

// Health zones per conversion rate
const HEALTH: { from: StageKey; to: StageKey; label: string; low: number; high: number; lowLabel: string; highLabel: string }[] = [
  {
    from: "totalApplications", to: "passedScreening",
    label: "推荐率", low: 20, high: 35,
    lowLabel: "JD要求过高或渠道不匹配", highLabel: "筛选标准可能太宽松",
  },
  {
    from: "passedScreening", to: "passedBusinessReview",
    label: "业务筛选通过率", low: 30, high: 60,
    lowLabel: "推荐标准需调整", highLabel: "业务筛选可更严格",
  },
  {
    from: "passedBusinessReview", to: "interviewInvited",
    label: "邀约率", low: 60, high: 100,
    lowLabel: "业务通过后邀约不足", highLabel: "邀约含往期候选人（正常）",
  },
  {
    from: "interviewInvited", to: "interviewAttendees",
    label: "面试到场率", low: 70, high: 85,
    lowLabel: "邀约方式需改进", highLabel: "候选人意向强烈",
  },
  {
    from: "interviewAttendees", to: "offersSent",
    label: "Offer发出率", low: 25, high: 40,
    lowLabel: "面试标准可能过高", highLabel: "面试标准可能过低",
  },
  {
    from: "offersSent", to: "offersAccepted",
    label: "Offer接受率", low: 70, high: 100,
    lowLabel: "薪资或竞争力需提升", highLabel: "",
  },
  {
    from: "offersAccepted", to: "onboarded",
    label: "入职率", low: 90, high: 100,
    lowLabel: "Offer期间跟进不够", highLabel: "",
  },
]

interface FunnelRow {
  date: string
  totalApplications: number
  passedScreening: number
  passedBusinessReview: number
  interviewInvited: number
  interviewAttendees: number
  offersSent: number
  offersAccepted: number
  onboarded: number
}

interface AggregatedRow {
  label: string
  totalApplications: number
  passedScreening: number
  passedBusinessReview: number
  interviewInvited: number
  interviewAttendees: number
  offersSent: number
  offersAccepted: number
  onboarded: number
}

type ViewType = "daily" | "weekly" | "monthly"

function getWeekLabel(d: Date): string {
  const date = new Date(d)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(date.setDate(diff))
  const weekNum = Math.ceil(
    (new Date(monday.getFullYear(), 0, 1).getDay() <= 3
      ? (monday.getTime() - new Date(monday.getFullYear(), 0, 1).getTime()) / 86400000 + 1
      : monday.getDate()) / 7
  )
  return `${monday.getFullYear()}-W${String(weekNum || 1).padStart(2, "0")}`
}

function getMonthLabel(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

function aggregate(rows: FunnelRow[], view: ViewType): AggregatedRow[] {
  const map = new Map<string, Record<StageKey, number>>()
  for (const r of rows) {
    const key = view === "daily"
      ? r.date
      : view === "weekly"
        ? getWeekLabel(new Date(r.date + "T00:00:00"))
        : getMonthLabel(new Date(r.date + "T00:00:00"))

    if (!map.has(key)) {
      map.set(key, { totalApplications: 0, passedScreening: 0, passedBusinessReview: 0, interviewInvited: 0, interviewAttendees: 0, offersSent: 0, offersAccepted: 0, onboarded: 0 })
    }
    const acc = map.get(key)!
    for (const s of STAGES) {
      acc[s.key] += r[s.key] || 0
    }
  }
  return Array.from(map.entries())
    .map(([label, v]) => ({ label, ...v }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const internship = await prisma.internship.findFirst({
      where: { userId: session.user.id, isActive: true },
      select: { id: true },
    })
    if (!internship) {
      return NextResponse.json({
        data: { daily: [], weekly: [], monthly: [], total: null, stages: STAGES.map((s) => ({ key: s.key, label: s.label, shortLabel: s.shortLabel })), health: HEALTH },
      })
    }

    // Feishu 候选人看板 is source of truth: pull latest candidates into local DB
    // before deriving (throttled to avoid hitting Feishu on every request).
    const now = Date.now()
    if ((lastPull.get(internship.id) ?? 0) < now - PULL_TTL_MS) {
      lastPull.set(internship.id, now)
      await pullCandidatesFromFeishu(internship.id)
    }

    // Format the stored date in Beijing time so it is correct on any server TZ.
    function fmtDate(d: Date): string {
      return d.toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" })
    }

    // Daily counts (推荐→入职) are DERIVED by counting candidates' stage-entry
    // dates. 简历投递量 has no names, so it stays a manual per-day input read
    // from RecruitmentFunnel.
    const candidates = await prisma.candidate.findMany({ where: { internshipId: internship.id } })
    const funnelRows = await prisma.recruitmentFunnel.findMany({ where: { internshipId: internship.id } })

    const emptyCounts = (): Record<StageKey, number> => ({
      totalApplications: 0, passedScreening: 0, passedBusinessReview: 0, interviewInvited: 0,
      interviewAttendees: 0, offersSent: 0, offersAccepted: 0, onboarded: 0,
    })
    const byDate = new Map<string, Record<StageKey, number>>()
    const getDay = (ymd: string) => {
      if (!byDate.has(ymd)) byDate.set(ymd, emptyCounts())
      return byDate.get(ymd)!
    }
    const bump = (d: Date | null, key: StageKey) => {
      if (!d) return
      getDay(fmtDate(d))[key] += 1
    }
    for (const c of candidates) {
      bump(c.recommendedDate, "passedScreening")
      bump(c.businessPassDate, "passedBusinessReview")
      bump(c.interviewInviteDate, "interviewInvited")
      bump(c.interviewDate, "interviewAttendees")
      bump(c.offerDate, "offersSent")
      bump(c.offerAcceptDate, "offersAccepted")
      bump(c.onboardDate, "onboarded")
    }
    for (const r of funnelRows) {
      getDay(fmtDate(r.date)).totalApplications += r.totalApplications
    }

    const rows: FunnelRow[] = Array.from(byDate.entries())
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => a.date.localeCompare(b.date))

    const daily = aggregate(rows, "daily")
    const weekly = aggregate(rows, "weekly")
    const monthly = aggregate(rows, "monthly")

    const total = rows.length > 0
      ? {
          totalApplications: rows.reduce((s, r) => s + r.totalApplications, 0),
          passedScreening: rows.reduce((s, r) => s + r.passedScreening, 0),
          passedBusinessReview: rows.reduce((s, r) => s + r.passedBusinessReview, 0),
          interviewInvited: rows.reduce((s, r) => s + r.interviewInvited, 0),
          interviewAttendees: rows.reduce((s, r) => s + r.interviewAttendees, 0),
          offersSent: rows.reduce((s, r) => s + r.offersSent, 0),
          offersAccepted: rows.reduce((s, r) => s + r.offersAccepted, 0),
          onboarded: rows.reduce((s, r) => s + r.onboarded, 0),
        }
      : null

    return NextResponse.json({
      data: {
        daily,
        weekly,
        monthly,
        total,
        stages: STAGES.map((s) => ({ key: s.key, label: s.label, shortLabel: s.shortLabel })),
        health: HEALTH,
      },
    })
  } catch (error) {
    return handleApiError(error, "GET /api/stats/funnel")
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const internship = await prisma.internship.findFirst({
      where: { userId: session.user.id, isActive: true },
      select: { id: true },
    })
    if (!internship) {
      return badRequest("未找到活跃的实习")
    }

    const body = await req.json()
    const { date } = body
    if (!date) return badRequest("日期不能为空")

    // Normalize to Beijing midnight so the same calendar day maps to one row
    // regardless of server timezone.
    const dataDate = new Date(beijingMidnightMs(new Date(date)))

    // Only 简历投递量 is a manual per-day input; the rest of the funnel is
    // derived from the candidate board. Accept totalApplications + note here.
    const totalApplications = typeof body.totalApplications === "number" ? body.totalApplications : 0

    const existing = await prisma.recruitmentFunnel.findUnique({
      where: { internshipId_date: { internshipId: internship.id, date: dataDate } },
    })

    let result
    if (existing) {
      result = await prisma.recruitmentFunnel.update({
        where: { id: existing.id },
        data: {
          totalApplications,
          ...(body.note !== undefined ? { note: body.note } : {}),
        },
      })
    } else {
      result = await prisma.recruitmentFunnel.create({
        data: {
          internshipId: internship.id,
          date: dataDate,
          totalApplications,
          note: body.note ?? null,
        },
      })
    }

    return NextResponse.json({ data: result }, { status: 201 })
  } catch (error) {
    return handleApiError(error, "POST /api/stats/funnel")
  }
}
