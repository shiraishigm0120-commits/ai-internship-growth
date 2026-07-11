import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { resolveUserAI } from "@/lib/ai-provider"
import { getRecruitmentStats } from "@/lib/recruitment-stats"
import { generateRecruitmentStar } from "@/lib/ai/recruitment-star"
import { handleApiError, badRequest } from "@/lib/api-utils"

function normPos(p: string | null): string {
  const s = (p ?? "").trim()
  if (!s) return "其他"
  if (s.includes("抽卡")) return "抽卡师"
  if (s.includes("编剧")) return "短剧编剧"
  if (s.includes("内容策划") || s.includes("内容策略")) return "内容策划运营"
  if (s.includes("审核")) return "剧本审核专员"
  if (s.includes("运营")) return "短剧运营"
  return s
}

export async function POST() {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const internship = await prisma.internship.findFirst({
      where: { userId: session.user.id, isActive: true },
      select: { id: true },
    })
    if (!internship) return badRequest("未找到活跃的实习")

    const stats = await getRecruitmentStats(internship.id)
    if (stats.totalCandidates === 0 && stats.totalApplications === 0) {
      return badRequest("暂无招聘数据，先在候选人看板或每日复盘中记录招聘工作")
    }

    // Group candidates by normalized position for context.
    const candidates = await prisma.candidate.findMany({
      where: { internshipId: internship.id },
      select: { position: true },
    })
    const posMap = new Map<string, number>()
    for (const c of candidates) {
      const p = normPos(c.position)
      posMap.set(p, (posMap.get(p) ?? 0) + 1)
    }
    const positions = Array.from(posMap.entries()).map(([position, count]) => ({ position, count }))

    const { client, model, isReal } = await resolveUserAI(session.user.id)
    if (!isReal) return badRequest("生成 STAR 案例需要配置 AI Key（个人 → 个人设置）")

    const star = await generateRecruitmentStar(stats, positions, client, model)
    if (!star) return badRequest("生成失败，请稍后重试")

    const created = await prisma.sTARCase.create({
      data: {
        internshipId: internship.id,
        title: star.title,
        situation: star.situation,
        task: star.task,
        action: star.action,
        result: star.result,
        skills: JSON.stringify(star.skills),
        tags: JSON.stringify(star.tags),
        impact: star.impact,
        isAiGenerated: true,
      },
    })

    return NextResponse.json({ data: created }, { status: 201 })
  } catch (error) {
    return handleApiError(error, "POST /api/star-cases/generate-recruitment")
  }
}
