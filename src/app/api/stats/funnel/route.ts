import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { handleApiError, badRequest } from "@/lib/api-utils"
import { syncFunnelToFeishu } from "@/lib/feishu"

export const STAGES = [
  { key: "totalApplications", label: "简历投递量", shortLabel: "投递" },
  { key: "passedScreening", label: "初筛通过", shortLabel: "初筛" },
  { key: "passedBusinessReview", label: "业务筛选通过", shortLabel: "业务筛选" },
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
    label: "初筛通过率", low: 20, high: 35,
    lowLabel: "JD要求过高或渠道不匹配", highLabel: "筛选标准可能太宽松",
  },
  {
    from: "passedScreening", to: "passedBusinessReview",
    label: "业务筛选通过率", low: 30, high: 60,
    lowLabel: "初筛标准需调整", highLabel: "业务筛选可更严格",
  },
  {
    from: "passedBusinessReview", to: "interviewAttendees",
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
      map.set(key, { totalApplications: 0, passedScreening: 0, passedBusinessReview: 0, interviewAttendees: 0, offersSent: 0, offersAccepted: 0, onboarded: 0 })
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

    const data = await prisma.recruitmentFunnel.findMany({
      where: { internshipId: internship.id },
      orderBy: { date: "asc" },
    })

    const rows: FunnelRow[] = data.map((r) => ({
      date: r.date.toISOString().slice(0, 10),
      totalApplications: r.totalApplications,
      passedScreening: r.passedScreening,
      passedBusinessReview: r.passedBusinessReview,
      interviewAttendees: r.interviewAttendees,
      offersSent: r.offersSent,
      offersAccepted: r.offersAccepted,
      onboarded: r.onboarded,
    }))

    const daily = aggregate(rows, "daily")
    const weekly = aggregate(rows, "weekly")
    const monthly = aggregate(rows, "monthly")

    const total = rows.length > 0
      ? {
          totalApplications: rows.reduce((s, r) => s + r.totalApplications, 0),
          passedScreening: rows.reduce((s, r) => s + r.passedScreening, 0),
          passedBusinessReview: rows.reduce((s, r) => s + r.passedBusinessReview, 0),
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

    const dataDate = new Date(date)
    dataDate.setHours(0, 0, 0, 0)

    const numericFields: StageKey[] = [
      "totalApplications", "passedScreening", "passedBusinessReview",
      "interviewAttendees", "offersSent", "offersAccepted", "onboarded",
    ]

    const existing = await prisma.recruitmentFunnel.findUnique({
      where: { internshipId_date: { internshipId: internship.id, date: dataDate } },
    })

    let result
    if (existing) {
      const updateData: Record<string, unknown> = {}
      for (const f of numericFields) {
        if (typeof body[f] === "number") updateData[f] = body[f]
      }
      if (body.note !== undefined) updateData.note = body.note
      result = await prisma.recruitmentFunnel.update({ where: { id: existing.id }, data: updateData })
    } else {
      result = await prisma.recruitmentFunnel.create({
        data: {
          internshipId: internship.id,
          date: dataDate,
          ...Object.fromEntries(numericFields.map((f) => [f, typeof body[f] === "number" ? body[f] : 0])),
          note: body.note ?? null,
        } as never,
      })
    }

    // Sync to Feishu (non-critical)
    await syncFunnelToFeishu(dataDate, {
      totalApplications: (result.totalApplications as number) ?? 0,
      passedScreening: (result.passedScreening as number) ?? 0,
      passedBusinessReview: (result.passedBusinessReview as number) ?? 0,
      interviewAttendees: (result.interviewAttendees as number) ?? 0,
      offersSent: (result.offersSent as number) ?? 0,
      offersAccepted: (result.offersAccepted as number) ?? 0,
      onboarded: (result.onboarded as number) ?? 0,
      note: (result.note as string) ?? undefined,
    })

    return NextResponse.json({ data: result }, { status: 201 })
  } catch (error) {
    return handleApiError(error, "POST /api/stats/funnel")
  }
}
