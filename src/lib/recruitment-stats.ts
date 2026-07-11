import { prisma } from "@/lib/prisma"

export interface RecruitmentStats {
  // Cumulative resumes received (no per-person names) — summed from daily funnel.
  totalApplications: number
  // Distinct-candidate counts by furthest stage reached (from the board).
  recommended: number
  businessPassed: number
  interviewInvited: number
  interviewed: number
  // Interviews actually attended — summed from the daily funnel (面试到场), which
  // reflects real attendance. `interviewed` (candidate 面试日期 count) also counts
  // scheduled/future interviews, so it must NOT be used for achievement stats.
  interviewAttended: number
  offered: number
  accepted: number
  onboarded: number
  // Candidates still active in the pipeline (not 已淘汰 / not terminal-rejected).
  activePipeline: number
  totalCandidates: number
}

const TERMINAL_OUT = new Set(["已淘汰"])

/**
 * Authoritative recruitment metrics for an internship, computed directly from
 * RecruitmentFunnel (resume volume) + Candidate (distinct people per stage).
 * Distinct-person counts are more accurate for career-capital than daily sums.
 */
export async function getRecruitmentStats(internshipId: string): Promise<RecruitmentStats> {
  const [funnels, candidates] = await Promise.all([
    prisma.recruitmentFunnel.findMany({
      where: { internshipId },
      select: { totalApplications: true, interviewAttendees: true },
    }),
    prisma.candidate.findMany({
      where: { internshipId },
      select: {
        currentStage: true,
        recommendedDate: true,
        businessPassDate: true,
        interviewInviteDate: true,
        interviewDate: true,
        offerDate: true,
        offerAcceptDate: true,
        onboardDate: true,
      },
    }),
  ])

  const totalApplications = funnels.reduce((s, f) => s + f.totalApplications, 0)
  const interviewAttended = funnels.reduce((s, f) => s + f.interviewAttendees, 0)
  const count = (pred: (c: (typeof candidates)[number]) => boolean) => candidates.filter(pred).length

  return {
    totalApplications,
    recommended: count((c) => c.recommendedDate != null),
    businessPassed: count((c) => c.businessPassDate != null),
    interviewInvited: count((c) => c.interviewInviteDate != null),
    interviewed: count((c) => c.interviewDate != null),
    interviewAttended,
    offered: count((c) => c.offerDate != null),
    accepted: count((c) => c.offerAcceptDate != null),
    onboarded: count((c) => c.onboardDate != null),
    activePipeline: count((c) => !TERMINAL_OUT.has(c.currentStage)),
    totalCandidates: candidates.length,
  }
}

/**
 * Recruitment contribution to 职业资本 (career capital), as accurate counts.
 * Only non-zero entries are returned so it merges cleanly with AI-derived capital.
 */
export function recruitmentCareerCapital(
  s: RecruitmentStats
): { category: string; count: number; unit: string }[] {
  const entries: { category: string; count: number; unit: string }[] = [
    { category: "筛选简历", count: s.totalApplications, unit: "份" },
    { category: "推荐候选人", count: s.recommended, unit: "人" },
    { category: "组织面试", count: s.interviewAttended, unit: "场" },
    { category: "发出Offer", count: s.offered, unit: "个" },
    { category: "成功入职", count: s.onboarded, unit: "人" },
  ]
  return entries.filter((e) => e.count > 0)
}
