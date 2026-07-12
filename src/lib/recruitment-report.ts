import { prisma } from "@/lib/prisma"
import { beijingYmd } from "@/lib/workdays"
import { beijingMidnightMs } from "@/lib/feishu"

// "2026-07-10" → "7-10"
function mmdd(ymd: string): string {
  const [, m, d] = ymd.split("-").map(Number)
  return `${m}-${d}`
}

/**
 * Assemble the recruiting daily report for a given Beijing day, in the user's
 * fixed 8-section format. Numbers/names are computed deterministically from the
 * candidate board; 今日心得 comes from that day's 复盘 (DailyRecord). Sections
 * 4–7 are current-stage snapshots (accurate for "today").
 */
export async function generateDailyReport(
  internshipId: string,
  dateYmd: string,
  userName: string,
): Promise<{ date: string; title: string; text: string }> {
  const dayMs = beijingMidnightMs(new Date(`${dateYmd}T12:00:00+08:00`))

  const [candidates, record] = await Promise.all([
    prisma.candidate.findMany({ where: { internshipId } }),
    prisma.dailyRecord.findUnique({
      where: { internshipId_date: { internshipId, date: new Date(dayMs) } },
      select: { reflection: true, summary: true },
    }),
  ])

  const dOf = (dt: Date | null) => (dt ? beijingYmd(dt) : null)
  const posCity = (c: { position: string | null; baseLocation: string | null }) =>
    `${c.position ?? "未分类"}${c.baseLocation ? `-${c.baseLocation}` : ""}`

  // Aggregate line: "岗位-城市N，岗位-城市N"
  const aggregate = (list: typeof candidates) => {
    const m = new Map<string, number>()
    for (const c of list) m.set(posCity(c), (m.get(posCity(c)) ?? 0) + 1)
    return [...m.entries()].map(([k, n]) => `${k}${n}`).join("，")
  }
  // Named line: "岗位-城市-姓名，..."
  const named = (list: typeof candidates) => list.map((c) => `${posCity(c)}-${c.name}`).join("，")

  const sec1 = candidates.filter((c) => dOf(c.recommendedDate) === dateYmd)
  const sec2 = candidates.filter((c) => dOf(c.interviewInviteDate) === dateYmd)
  const sec3 = candidates.filter((c) => dOf(c.interviewDate) === dateYmd)
  const sec4 = candidates.filter((c) => c.currentStage === "面试通过-流程中" && c.subStatus !== "流程中/待谈薪")
  const sec5 = candidates.filter((c) => c.currentStage === "待入职")
  const sec6 = candidates.filter((c) => c.currentStage === "面试通过-流程中" && c.subStatus === "流程中/待谈薪")
  const sec7 = candidates.filter((c) => c.currentStage === "已淘汰")

  const withCount = (n: number, detail: string) => (n ? `${n}（${detail}）` : `${n}`)
  const insight = record?.reflection || record?.summary || "（今日未复盘）"

  const title = `${userName}${mmdd(dateYmd)} 日报`
  const text = [
    title,
    `1、推荐简历：${withCount(sec1.length, aggregate(sec1))}`,
    `2、邀约面试：${withCount(sec2.length, aggregate(sec2))}`,
    `3、今日面试：${withCount(sec3.length, aggregate(sec3))}`,
    `4、面试通过：${withCount(sec4.length, named(sec4))}`,
    `5、待入职：${withCount(sec5.length, named(sec5))}`,
    `6、流程中/待谈薪：${withCount(sec6.length, named(sec6))}`,
    `7、淘汰：${withCount(sec7.length, named(sec7))}`,
    `8、今日心得：${insight}`,
  ].join("\n")

  return { date: dateYmd, title, text }
}
