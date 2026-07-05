import OpenAI from "openai"
import { prisma } from "@/lib/prisma"

export interface DiscoveryInsight {
  type: "skill_change" | "milestone" | "streak" | "challenge_solved" | "pattern" | "first_time"
  title: string
  description: string
  icon: string
  priority: number // 1=highest, show first
  relatedSkill?: string
}

export interface DailyDiscovery {
  insights: DiscoveryInsight[]
  skillChanges: { name: string; from: number; to: number; direction: "up" | "down" | "new" }[]
  headline: string // The ONE thing user should see in 3 seconds
  nextAction: string // "明天建议你做 X"
}

// Runs without AI — pure data comparison. Fast, free, always works.
export async function discoverFromData(
  userId: string
): Promise<DailyDiscovery> {
  const insights: DiscoveryInsight[] = []
  const skillChanges: DailyDiscovery["skillChanges"] = []

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const oneMonthAgo = new Date(today)
  oneMonthAgo.setDate(oneMonthAgo.getDate() - 30)

  const internships = await prisma.internship.findMany({
    where: { userId },
    select: { id: true },
  })
  const internshipIds = internships.map((i) => i.id)

  // Get today's record
  const activeInternship = await prisma.internship.findFirst({
    where: { userId, isActive: true },
    orderBy: { startDate: "desc" },
  })
  const todayRecord = activeInternship
    ? await prisma.dailyRecord.findUnique({
        where: {
          internshipId_date: {
            internshipId: activeInternship.id,
            date: today,
          },
        },
        include: {
          workItems: true,
          knowledgeItems: true,
          achievements: true,
        },
      })
    : null

  // Get last two growth memories to compare skill levels
  const [latestMemory, previousMemory] = await Promise.all([
    prisma.growthMemory.findFirst({
      where: { userId },
      orderBy: { date: "desc" },
    }),
    prisma.growthMemory.findFirst({
      where: { userId, date: { lt: today } },
      orderBy: { date: "desc" },
    }),
  ])

  // Compare skill levels
  if (latestMemory && previousMemory) {
    const currentSkills: { name: string; level: number }[] = JSON.parse(
      latestMemory.skillsSnapshot
    )
    const pastSkills: { name: string; level: number }[] = JSON.parse(
      previousMemory.skillsSnapshot
    )

    for (const skill of currentSkills) {
      const past = pastSkills.find((s) => s.name === skill.name)
      if (!past) {
        skillChanges.push({
          name: skill.name,
          from: 0,
          to: skill.level,
          direction: "new",
        })
      } else if (skill.level > past.level) {
        skillChanges.push({
          name: skill.name,
          from: past.level,
          to: skill.level,
          direction: "up",
        })
      } else if (skill.level < past.level) {
        skillChanges.push({
          name: skill.name,
          from: past.level,
          to: skill.level,
          direction: "down",
        })
      }
    }
  }

  // Insight: skill improvements
  for (const change of skillChanges.filter((s) => s.direction === "up")) {
    insights.push({
      type: "skill_change",
      title: `${change.name} 能力提升`,
      description: `从 Lv.${change.from} → Lv.${change.to}，继续加油！`,
      icon: "📈",
      priority: 2,
      relatedSkill: change.name,
    })
  }

  // Insight: new skills unlocked
  for (const change of skillChanges.filter((s) => s.direction === "new")) {
    insights.push({
      type: "first_time",
      title: `解锁新能力：${change.name}`,
      description: "这是你第一次展现这项能力",
      icon: "🔓",
      priority: 1,
      relatedSkill: change.name,
    })
  }

  // Insight: streak
  if (todayRecord) {
    const streak = await calculateStreak(activeInternship!.id)
    if (streak === 7) {
      insights.push({
        type: "streak",
        title: "连续 7 天记录！",
        description: "你已经坚持一周了，习惯正在形成",
        icon: "🔥",
        priority: 1,
      })
    } else if (streak === 30) {
      insights.push({
        type: "streak",
        title: "连续 30 天记录！",
        description: "一个月的坚持，你已经超越 90% 的实习生",
        icon: "🏆",
        priority: 1,
      })
    } else if (streak > 0 && streak % 5 === 0) {
      insights.push({
        type: "streak",
        title: `连续 ${streak} 天记录`,
        description: "每天进步一点点",
        icon: "🔥",
        priority: 3,
      })
    }
  }

  // Insight: challenge solved (check if openChallenges from last memory are resolved)
  if (previousMemory && latestMemory) {
    const pastChallenges: { description: string; since: string }[] = JSON.parse(
      previousMemory.openChallenges
    )
    const currentChallenges: { description: string; since: string }[] = JSON.parse(
      latestMemory.openChallenges
    )

    for (const pc of pastChallenges) {
      if (!currentChallenges.find((c) => c.description === pc.description)) {
        insights.push({
          type: "challenge_solved",
          title: "困难已解决",
          description: `之前困扰你的「${pc.description}」已经不再是问题了`,
          icon: "✅",
          priority: 1,
        })
      }
    }
  }

  // Insight: first-time today (from today's data)
  if (todayRecord) {
    // First time with achievements
    if (todayRecord.achievements.length > 0) {
      for (const a of todayRecord.achievements) {
        insights.push({
          type: "first_time",
          title: a.title,
          description: a.description ?? "",
          icon: a.icon ?? "⭐",
          priority: 1,
        })
      }
    }

    // Check if this is the first record overall
    const totalRecords = await prisma.dailyRecord.count({
      where: { internshipId: { in: internshipIds } },
    })
    if (totalRecords === 1) {
      insights.push({
        type: "first_time",
        title: "第一次记录！",
        description: "这是你成长之旅的第一步，里程碑已标记",
        icon: "🚀",
        priority: 1,
      })
    }
  }

  // Build headline: the ONE thing
  const headline = buildHeadline(insights, skillChanges, todayRecord)

  // Build next action suggestion
  const memoryForNextAction = latestMemory
    ? {
        summary: latestMemory.summary,
        skills: JSON.parse(latestMemory.skillsSnapshot) as { name: string; level: number }[],
      }
    : null
  const nextAction = await buildNextAction(userId, skillChanges, memoryForNextAction)

  return {
    insights: insights.sort((a, b) => a.priority - b.priority),
    skillChanges,
    headline,
    nextAction,
  }
}

async function calculateStreak(internshipId: string): Promise<number> {
  const records = await prisma.dailyRecord.findMany({
    where: { internshipId },
    orderBy: { date: "desc" },
    select: { date: true },
    take: 100,
  })

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  let streak = 0
  for (const r of records) {
    const d = new Date(r.date)
    d.setHours(0, 0, 0, 0)
    const expected = today.getTime() - streak * 86400000
    if (d.getTime() === expected) {
      streak++
    } else {
      break
    }
  }
  return streak
}

function buildHeadline(
  insights: DiscoveryInsight[],
  skillChanges: DailyDiscovery["skillChanges"],
  todayRecord: unknown
): string {
  const top = insights[0]
  if (!top) {
    if (!todayRecord) return "今天还没有记录，花3分钟回顾一下吧"
    return "今日记录已完成"
  }

  switch (top.type) {
    case "skill_change":
      return `你的 ${top.relatedSkill} 能力提升了！`
    case "first_time":
      return top.title
    case "streak":
      return top.title
    case "challenge_solved":
      return top.title
    case "milestone":
      return `里程碑达成：${top.title}`
    default:
      return top.title
  }
}

async function buildNextAction(
  _userId: string,
  skillChanges: DailyDiscovery["skillChanges"],
  latestMemory: { summary: string; skills: { name: string; level: number }[] } | null
): Promise<string> {
  if (!latestMemory) return "开始你的第一次记录吧"

  // Find lowest-level skill
  const skills = latestMemory.skills
  if (skills.length === 0) return "今天想学点什么新东西？"

  const lowest = skills.reduce((a, b) => (a.level < b.level ? a : b))
  const highest = skills.reduce((a, b) => (a.level > b.level ? a : b))

  // Suggest strengthening weakest area
  if (lowest.level <= 3) {
    return `建议加强「${lowest.name}」，这是你的成长空间`
  }

  // Or suggest deepening the strongest
  if (highest.level >= 6) {
    return `「${highest.name}」是你的优势，继续深化`
  }

  return "今天想尝试什么新的挑战？"
}

// AI-powered deep analysis: runs occasionally for richer insights
const DISCOVERY_PROMPT = `你是一个成长分析引擎。你拿到了用户最近的数据，请从中发现隐藏的成长信号。

基于以下数据，输出 2-3 条洞察：

每条洞察包含：
- type: "pattern" | "milestone" | "insight"
- title: 一句话标题（10字以内）
- description: 解释为什么这是成长信号（30字以内）
- icon: 一个 emoji

聚焦于：
1. 用户自己可能没意识到的进步（比如 "虽然你自己没感觉，但你的数据分析已经从描述型升级到了诊断型"）
2. 跨越多个记录的成长模式（比如 "你连续 5 天都在接触招聘，你正在建立全流程视角"）
3. 值得注意的变化（比如 "你从'别人安排'变成了'主动承担'"）

只返回有确凿证据的洞察。如果数据中出现以下情况，强烈建议标记：
- 用户解决了之前提到的困难
- 用户开始独立做事（之前是跟着做）
- 用户从做具体任务升级到做决策/分析/规划
- 用户提到了之前没出现过的专业术语

返回 JSON: { "insights": [...] }`

export async function deepDiscovery(
  userId: string,
  openai?: OpenAI,
  model?: string
): Promise<DiscoveryInsight[]> {
  if (!openai) return []

  const oneMonthAgo = new Date()
  oneMonthAgo.setDate(oneMonthAgo.getDate() - 30)

  const internships = await prisma.internship.findMany({
    where: { userId },
    select: { id: true },
  })
  const internshipIds = internships.map((i) => i.id)

  const records = await prisma.dailyRecord.findMany({
    where: { internshipId: { in: internshipIds }, date: { gte: oneMonthAgo } },
    orderBy: { date: "asc" },
    select: {
      date: true,
      summary: true,
      title: true,
      workItems: { select: { title: true, type: true } },
      knowledgeItems: { select: { title: true, content: true } },
    },
    take: 30,
  })

  if (records.length < 3) return []

  const memory = await prisma.growthMemory.findFirst({
    where: { userId },
    orderBy: { date: "desc" },
  })

  try {
    const response = await openai.chat.completions.create({
      model: model ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      messages: [
        { role: "system", content: DISCOVERY_PROMPT },
        {
          role: "user",
          content: JSON.stringify({
            records: records.map((r) => ({
              date: r.date.toISOString().slice(0, 10),
              title: r.title,
              summary: r.summary,
              works: r.workItems.map((w) => w.title),
              knowledge: r.knowledgeItems.map((k) => k.title),
            })),
            growthMemory: memory
              ? {
                  summary: memory.summary,
                  skills: JSON.parse(memory.skillsSnapshot),
                  challenges: JSON.parse(memory.openChallenges),
                }
              : null,
          }),
        },
      ],
      temperature: 0.5,
      response_format: { type: "json_object" },
    })

    const result = JSON.parse(response.choices[0]?.message?.content ?? "{}")
    return (result.insights ?? []).map((i: DiscoveryInsight) => ({
      ...i,
      priority: i.priority ?? 2,
    }))
  } catch {
    return []
  }
}
