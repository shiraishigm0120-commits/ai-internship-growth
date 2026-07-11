import { NextResponse, after } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { handleApiError } from "@/lib/api-utils"
import { pullCandidatesFromFeishu } from "@/lib/feishu"

// Throttle Feishu pulls: at most one per internship per TTL window.
const lastPull = new Map<string, number>()
const PULL_TTL_MS = 30_000

// Board column order — must match the Feishu 当前阶段 single-select options exactly.
export const BOARD_STAGES = [
  "推荐简历", "业务筛选", "邀约面试", "已面试待反馈", "面试通过-流程中", "Offer", "待入职", "已入职", "已淘汰",
] as const

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
      return NextResponse.json({ data: { candidates: [], stages: BOARD_STAGES } })
    }

    // Feishu 候选人看板 is source of truth. Read the DB now (fast, always has
    // data) and refresh from Feishu AFTER the response — the pull's cross-region
    // writes never block or time out the read; fresh data lands on the next load.
    const now = Date.now()
    if ((lastPull.get(internship.id) ?? 0) < now - PULL_TTL_MS) {
      lastPull.set(internship.id, now)
      after(() => pullCandidatesFromFeishu(internship.id))
    }

    const candidates = await prisma.candidate.findMany({
      where: { internshipId: internship.id },
      orderBy: [{ updatedAt: "desc" }],
    })

    function fmt(d: Date | null): string | null {
      return d ? d.toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" }) : null
    }
    // Scheduled interview keeps the time-of-day.
    function fmtDateTime(d: Date | null): string | null {
      if (!d) return null
      return d.toLocaleString("zh-CN", {
        timeZone: "Asia/Shanghai",
        month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
      })
    }

    const data = candidates.map((c) => ({
      id: c.id,
      name: c.name,
      position: c.position,
      currentStage: c.currentStage,
      statusNote: c.statusNote,
      recommendedDate: fmt(c.recommendedDate),
      businessPassDate: fmt(c.businessPassDate),
      interviewInviteDate: fmt(c.interviewInviteDate),
      interviewDate: fmt(c.interviewDate),
      offerDate: fmt(c.offerDate),
      offerAcceptDate: fmt(c.offerAcceptDate),
      onboardDate: fmt(c.onboardDate),
      interviewScheduledAt: fmtDateTime(c.interviewScheduledAt),
    }))

    return NextResponse.json({ data: { candidates: data, stages: BOARD_STAGES } })
  } catch (error) {
    return handleApiError(error, "GET /api/candidates")
  }
}
