import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const internshipId = searchParams.get("internshipId")

  // Get active internship if no specific one requested
  let internship
  if (internshipId) {
    internship = await prisma.internship.findFirst({
      where: { id: internshipId, userId: session.user.id },
    })
  } else {
    internship = await prisma.internship.findFirst({
      where: { userId: session.user.id, isActive: true },
      orderBy: { startDate: "desc" },
    })
  }

  if (!internship) {
    return NextResponse.json({
      data: {
        todayRecorded: false,
        streakDays: 0,
        totalDays: 0,
        currentDay: 0,
        weeklyTasks: 0,
        totalTasks: 0,
        totalKnowledge: 0,
        totalSTARCases: 0,
        totalAchievements: 0,
        skillRadar: [],
        weeklyActivity: [],
        aiInsight: "创建你的第一个实习档案，开始记录成长吧！",
        recentRecords: [],
      },
    })
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Today's record
  const todayRecord = await prisma.dailyRecord.findUnique({
    where: {
      internshipId_date: {
        internshipId: internship.id,
        date: today,
      },
    },
  })

  // Total days
  const totalRecords = await prisma.dailyRecord.count({
    where: { internshipId: internship.id },
  })

  // Current internship day
  const startDate = new Date(internship.startDate)
  const currentDay = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1

  // Streak calculation
  let streakDays = 0
  const recentRecords = await prisma.dailyRecord.findMany({
    where: { internshipId: internship.id },
    orderBy: { date: "desc" },
    take: 30,
    select: { date: true },
  })

  let checkDate = new Date(today)
  for (const record of recentRecords) {
    const recordDate = new Date(record.date)
    recordDate.setHours(0, 0, 0, 0)
    const diff = Math.floor((checkDate.getTime() - recordDate.getTime()) / (1000 * 60 * 60 * 24))
    if (diff === 0) {
      streakDays++
      checkDate.setDate(checkDate.getDate() - 1)
    } else if (diff === 1) {
      streakDays++
      checkDate = recordDate
    } else {
      break
    }
  }

  // Total counts
  const totalTasks = await prisma.workItem.count({
    where: { record: { internshipId: internship.id } },
  })

  // Weekly tasks
  const weekAgo = new Date(today)
  weekAgo.setDate(weekAgo.getDate() - 7)
  const weeklyTasks = await prisma.workItem.count({
    where: {
      record: {
        internshipId: internship.id,
        date: { gte: weekAgo },
      },
    },
  })

  const totalKnowledge = await prisma.knowledge.count({
    where: { record: { internshipId: internship.id } },
  })

  const totalSTARCases = await prisma.sTARCase.count({
    where: { internshipId: internship.id },
  })

  const totalAchievements = await prisma.achievement.count({
    where: { record: { internshipId: internship.id } },
  })

  // Skill radar from user's own records (isolated per user)
  const userKnowledgeItems = await prisma.knowledge.findMany({
    where: { record: { internshipId: internship.id } },
    select: { tags: true },
  })

  const skillCounts = new Map<string, number>()
  for (const item of userKnowledgeItems) {
    const itemTags = JSON.parse(item.tags) as string[]
    for (const tag of itemTags) {
      skillCounts.set(tag, (skillCounts.get(tag) ?? 0) + 1)
    }
  }
  const tags = [...skillCounts.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([name, count]) => ({ name, usageCount: count }))

  const maxUsage = tags[0]?.usageCount ?? 1
  const skillRadar = tags.map((t) => ({
    skill: t.name,
    level: Math.min(100, Math.round((t.usageCount / maxUsage) * 100)),
  }))

  // Weekly activity heatmap
  const monthAgo = new Date(today)
  monthAgo.setDate(monthAgo.getDate() - 30)

  const monthRecords = await prisma.dailyRecord.findMany({
    where: {
      internshipId: internship.id,
      date: { gte: monthAgo },
    },
    select: { date: true, wordCount: true },
  })

  const weeklyActivity = monthRecords.map((r) => ({
    date: r.date.toISOString().slice(0, 10),
    count: r.wordCount,
  }))

  // Recent records
  const last7 = await prisma.dailyRecord.findMany({
    where: { internshipId: internship.id },
    orderBy: { date: "desc" },
    take: 7,
    select: {
      id: true,
      date: true,
      title: true,
      summary: true,
      mood: true,
    },
  })

  // AI Insight
  let aiInsight = ""
  if (totalRecords === 0) {
    aiInsight = "欢迎使用 AI 实习成长系统！点击「每日记录」开始你的第一次 AI 访谈吧。"
  } else if (streakDays >= 7) {
    aiInsight = `你已经连续记录了 ${streakDays} 天，非常棒！持续的记录能帮助你更好地沉淀成长。`
  } else if (!todayRecord) {
    aiInsight = "今天还没有记录哦，花3-5分钟和AI导师聊一聊今天的工作吧。"
  } else {
    aiInsight = "今天已经完成记录了，继续保持！定期回顾能帮你发现自己的成长轨迹。"
  }

  return NextResponse.json({
    data: {
      todayRecorded: !!todayRecord,
      streakDays,
      totalDays: totalRecords,
      currentDay,
      weeklyTasks,
      totalTasks,
      totalKnowledge,
      totalSTARCases,
      totalAchievements,
      skillRadar,
      weeklyActivity,
      aiInsight,
      recentRecords: last7.map((r) => ({
        id: r.id,
        date: r.date.toISOString(),
        title: r.title ?? "记录",
        summary: r.summary ?? undefined,
        mood: r.mood ?? undefined,
      })),
    },
  })
}
