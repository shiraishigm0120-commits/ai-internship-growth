import { prisma } from "@/lib/prisma"

export interface TodoItem {
  id: string
  label: string
  names: string[]
  priority: "high" | "medium"
  hint?: string
}

function beijingYmd(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" })
}

/**
 * Derive today's recruiting to-dos directly from the candidate board — no manual
 * upkeep. As the user updates candidates (in Feishu), the list updates itself.
 */
export async function getTodayTodos(internshipId: string): Promise<{ date: string; items: TodoItem[] }> {
  const today = beijingYmd(new Date())
  const tomorrow = beijingYmd(new Date(Date.now() + 86400000))

  const candidates = await prisma.candidate.findMany({
    where: { internshipId },
    select: { name: true, position: true, currentStage: true, interviewDate: true },
  })

  const withPos = (c: { name: string; position: string | null }) =>
    c.position ? `${c.name}(${c.position})` : c.name

  const todayInterviews: string[] = []
  const tomorrowInterviews: string[] = []
  const overdueInterviews: string[] = []
  const salaryFollowUp: string[] = []
  const awaitingFeedback: string[] = []

  for (const c of candidates) {
    const iv = c.interviewDate ? beijingYmd(c.interviewDate) : null
    if (iv === today) todayInterviews.push(withPos(c))
    else if (iv === tomorrow) tomorrowInterviews.push(withPos(c))
    else if (iv && iv < today && c.currentStage === "邀约面试") overdueInterviews.push(withPos(c))

    if (c.currentStage === "面试通过-流程中") salaryFollowUp.push(c.name)
    else if (c.currentStage === "已面试待反馈") awaitingFeedback.push(c.name)
  }

  const items: TodoItem[] = []
  if (todayInterviews.length)
    items.push({ id: "today-interview", label: "今日面试", names: todayInterviews, priority: "high", hint: "面试后及时更新看板阶段" })
  if (overdueInterviews.length)
    items.push({ id: "overdue-interview", label: "更新面试结果（面试日期已过）", names: overdueInterviews, priority: "high" })
  if (salaryFollowUp.length)
    items.push({ id: "salary", label: "跟进谈薪进度", names: salaryFollowUp, priority: "high" })
  if (awaitingFeedback.length)
    items.push({ id: "feedback", label: "催面试官反馈结果", names: awaitingFeedback, priority: "medium" })
  if (tomorrowInterviews.length)
    items.push({ id: "tomorrow-interview", label: "准备明日面试", names: tomorrowInterviews, priority: "medium" })

  return { date: today, items }
}
