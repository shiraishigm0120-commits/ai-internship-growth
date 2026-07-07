import OpenAI from "openai"
import { prisma } from "@/lib/prisma"

export interface GrowthMemoryData {
  summary: string
  skills: { name: string; level: number; lastPracticed?: string }[]
  openChallenges: { description: string; since: string }[]
  keyLearnings: { title: string; content: string }[]
  isMilestone: boolean
  milestoneTitle?: string
  milestoneIcon?: string
  careerCapital: { category: string; count: number; unit: string }[]
}

// AI may return skills as object {"name": level} or array [{name, level}]. Normalize.
function normalizeSkillsArray(raw: unknown): { name: string; level: number; lastPracticed?: string }[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  if (typeof raw === "object") {
    return Object.entries(raw as Record<string, unknown>).map(([name, value]) => ({
      name,
      level: typeof value === "number" ? value : (typeof value === "object" && value !== null ? (value as Record<string, unknown>).level as number ?? 3 : 3),
    }))
  }
  return []
}

// AI may return career capital as object {"category": count} or array [{category, count, unit}]
function normalizeCareerCapitalArray(raw: unknown): { category: string; count: number; unit: string }[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  if (typeof raw === "object") {
    return Object.entries(raw as Record<string, unknown>).map(([category, count]) => ({
      category,
      count: typeof count === "number" ? count : 0,
      unit: "",
    }))
  }
  return []
}

const GENERATE_PROMPT = `你是一个成长分析系统。你需要分析用户最近的实习记录，生成成长记忆。

从以下数据中提取：

1. summary: 用 2-3 句话总结用户近期的成长状态。包含：主要技能方向、进步点、待加强点。
   例："用户本周在招聘流程方面进步明显，Excel 仍需要练习。沟通能力正在从初级向中级过渡。"

2. skills: 用户当前正在发展的技能及水平（1-10）。
   从以下技能维度评估：招聘、数据分析、沟通协调、文档写作、项目管理、工具使用、行业知识、领导力
   只提取有明确证据的技能，不要猜测。

3. openChallenges: 用户提到但尚未解决的困难。包含 description 和 since（日期）。

4. keyLearnings: 用户最近学到的关键知识或技能。包含 title 和 content。

5. isMilestone: 今天是否是成长里程碑？
   判断标准：「第一次」完成某事、获得表扬、重大突破、项目完成、技能升级。
   如果是，提供 milestoneTitle 和 milestoneIcon (一个 emoji)。

6. careerCapital: 累计职业资本。从所有记录中汇总：
   - 如「筛选简历」= 份，「参与面试」= 场，「数据分析报告」= 份
   - 动态识别类型，不限于固定列表

返回 JSON 格式，只返回 JSON，不要有任何解释。`

export async function generateGrowthMemory(
  userId: string,
  conversation: { role: string; content: string }[],
  extractedData: {
    skills: string[]
    achievements: { title: string; description: string; category: string }[]
  },
  openai?: OpenAI,
  model?: string
): Promise<GrowthMemoryData> {
  if (!openai) return getFallbackGrowthMemory(extractedData)

  // Gather recent context for growth analysis
  const oneMonthAgo = new Date()
  oneMonthAgo.setDate(oneMonthAgo.getDate() - 30)

  const internships = await prisma.internship.findMany({
    where: { userId },
    select: { id: true },
  })
  const internshipIds = internships.map((i) => i.id)

  const recentRecords = await prisma.dailyRecord.findMany({
    where: { internshipId: { in: internshipIds }, date: { gte: oneMonthAgo } },
    orderBy: { date: "desc" },
    select: {
      date: true,
      summary: true,
      title: true,
      workItems: { select: { title: true, type: true } },
      knowledgeItems: { select: { title: true, category: true } },
    },
  })

  const lastMemory = await prisma.growthMemory.findFirst({
    where: { userId },
    orderBy: { date: "desc" },
  })

  const contextData = {
    todayConversation: conversation
      .filter((m) => m.role === "user")
      .map((m) => m.content)
      .join("\n"),
    extractedSkills: extractedData.skills,
    extractedAchievements: extractedData.achievements,
    recentRecords: recentRecords.map((r) => ({
      date: r.date.toISOString().slice(0, 10),
      title: r.title,
      summary: r.summary,
      workCount: r.workItems.length,
      knowledgeCount: r.knowledgeItems.length,
    })),
    lastGrowthMemory: lastMemory
      ? {
          summary: lastMemory.summary,
          skills: JSON.parse(lastMemory.skillsSnapshot),
          challenges: JSON.parse(lastMemory.openChallenges),
        }
      : null,
  }

  try {
    const response = await openai.chat.completions.create({
      model: model ?? (process.env.AI_MODEL || process.env.OPENAI_MODEL) ?? "gpt-4o-mini",
      messages: [
        { role: "system", content: GENERATE_PROMPT },
        { role: "user", content: JSON.stringify(contextData, null, 2) },
      ],
      temperature: 0.5,
      response_format: { type: "json_object" },
    })

    const result = JSON.parse(response.choices[0]?.message?.content ?? "{}")
    return {
      summary: result.summary ?? "",
      skills: normalizeSkillsArray(result.skills),
      openChallenges: result.openChallenges ?? [],
      keyLearnings: result.keyLearnings ?? [],
      isMilestone: result.isMilestone ?? false,
      milestoneTitle: result.milestoneTitle,
      milestoneIcon: result.milestoneIcon,
      careerCapital: normalizeCareerCapitalArray(result.careerCapital),
    }
  } catch (error) {
    console.error("Growth memory generation failed:", error)
    return getFallbackGrowthMemory(extractedData)
  }
}

function getFallbackGrowthMemory(extractedData: {
  skills: string[]
  achievements: { title: string; description: string; category: string }[]
}): GrowthMemoryData {
  return {
    summary: `用户正在发展 ${extractedData.skills.join("、") || "各方面能力"}`,
    skills: extractedData.skills.map((s) => ({ name: s, level: 3 })),
    openChallenges: [],
    keyLearnings: [],
    isMilestone: extractedData.achievements.length > 0,
    milestoneTitle: extractedData.achievements[0]?.title,
    milestoneIcon: "⭐",
    careerCapital: [],
  }
}

export async function getLatestGrowthMemory(
  userId: string
): Promise<GrowthMemoryData | null> {
  const memory = await prisma.growthMemory.findFirst({
    where: { userId },
    orderBy: { date: "desc" },
  })

  if (!memory) return null

  return {
    summary: memory.summary,
    skills: normalizeSkillsArray(JSON.parse(memory.skillsSnapshot)),
    openChallenges: JSON.parse(memory.openChallenges),
    keyLearnings: JSON.parse(memory.keyLearnings),
    isMilestone: memory.isMilestone,
    milestoneTitle: memory.milestoneTitle ?? undefined,
    milestoneIcon: memory.milestoneIcon ?? undefined,
    careerCapital: normalizeCareerCapitalArray(JSON.parse(memory.careerCapital)),
  }
}

export async function saveGrowthMemory(
  userId: string,
  data: GrowthMemoryData
) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Upsert: one memory per day
  const existing = await prisma.growthMemory.findFirst({
    where: { userId, date: today },
  })

  const saveData = {
    skillsSnapshot: JSON.stringify(data.skills),
    openChallenges: JSON.stringify(data.openChallenges),
    keyLearnings: JSON.stringify(data.keyLearnings),
    isMilestone: data.isMilestone,
    milestoneTitle: data.milestoneTitle,
    milestoneIcon: data.milestoneIcon,
    summary: data.summary,
    careerCapital: JSON.stringify(data.careerCapital),
  }

  if (existing) {
    await prisma.growthMemory.update({ where: { id: existing.id }, data: saveData })
  } else {
    await prisma.growthMemory.create({
      data: { userId, date: today, ...saveData },
    })
  }

  // Sync skills to Skill table (first-class model)
  for (const skill of data.skills) {
    const existing = await prisma.skill.findUnique({
      where: { userId_name: { userId, name: skill.name } },
    })
    if (existing) {
      const trend =
        skill.level > existing.level
          ? "improving"
          : skill.level < existing.level
            ? "declining"
            : "stable"
      await prisma.skill.update({
        where: { userId_name: { userId, name: skill.name } },
        data: {
          level: skill.level,
          trend,
          lastSeen: new Date(),
          evidenceCount: { increment: 1 },
        },
      })
    } else {
      await prisma.skill.create({
        data: {
          userId,
          name: skill.name,
          level: skill.level,
          trend: "stable",
          firstSeen: new Date(),
          lastSeen: new Date(),
          evidenceCount: 1,
          category: inferSkillCategory(skill.name),
        },
      })
    }
  }

  // If milestone detected, create a Milestone record
  if (data.isMilestone && data.milestoneTitle) {
    await prisma.milestone.create({
      data: {
        userId,
        title: data.milestoneTitle,
        description: data.summary,
        icon: data.milestoneIcon ?? "⭐",
        date: new Date(),
        category: "achievement",
      },
    })
  }
}

function inferSkillCategory(name: string): string {
  const toolSkills = ["excel", "ppt", "sql", "python", "figma", "tableau", "powerbi", "jira", "notion"]
  const softSkills = ["沟通", "协作", "领导", "演讲", "谈判", "写作", "时间管理", "项目管理"]
  const domainSkills = ["招聘", "培训", "薪酬", "绩效", "员工关系", "财务", "法务", "营销", "运营"]

  const lower = name.toLowerCase()
  if (toolSkills.some((t) => lower.includes(t))) return "tool"
  if (softSkills.some((t) => lower.includes(t))) return "soft"
  if (domainSkills.some((t) => lower.includes(t))) return "domain"
  return "professional"
}
