import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getOpenAI } from "@/lib/openai"
import { decrypt } from "@/lib/crypto"
import { discoverFromData, deepDiscovery } from "@/lib/ai/discovery"

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Batch all independent queries
  const [internship, growthMemory, settings] = await Promise.all([
    prisma.internship.findFirst({
      where: { userId: session.user.id, isActive: true },
      orderBy: { startDate: "desc" },
    }),
    prisma.growthMemory.findFirst({
      where: { userId: session.user.id },
      orderBy: { date: "desc" },
    }),
    prisma.userSettings.findUnique({
      where: { userId: session.user.id },
      select: { openaiApiKey: true, aiModel: true },
    }),
  ])

  if (!internship) {
    return NextResponse.json({
      data: {
        todayRecorded: false,
        currentDay: 0,
        streakDays: 0,
        discovery: null,
      },
    })
  }

  const startDate = new Date(internship.startDate)
  const currentDay =
    Math.floor((Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1

  // Batch record queries
  const [todayRecord, allRecords] = await Promise.all([
    prisma.dailyRecord.findUnique({
      where: { internshipId_date: { internshipId: internship.id, date: today } },
      include: { workItems: true, knowledgeItems: true, achievements: true },
    }),
    prisma.dailyRecord.findMany({
      where: { internshipId: internship.id },
      orderBy: { date: "desc" },
      select: { date: true },
    }),
  ])

  // Calculate streak
  let streak = 0
  const todayTime = today.getTime()
  for (let i = 0; i < allRecords.length; i++) {
    const expected = todayTime - i * 86400000
    const recordDate = new Date(allRecords[i].date)
    recordDate.setHours(0, 0, 0, 0)
    if (recordDate.getTime() === expected) {
      streak++
    } else {
      break
    }
  }

  // Run data discovery (no AI cost, always runs)
  const discovery = await discoverFromData(session.user.id)

  // Run deep discovery only for real AI users, occasionally
  const recordCount = allRecords.length
  const userKey = settings?.openaiApiKey ? decrypt(settings.openaiApiKey) : null
  const aiModel = settings?.aiModel || process.env.OPENAI_MODEL || "gpt-4o"
  let deepInsights = discovery.insights
  if (userKey && recordCount > 0 && (recordCount % 3 === 0 || discovery.insights.some((i) => i.priority === 1))) {
    const deep = await deepDiscovery(session.user.id, getOpenAI(userKey), aiModel)
    deepInsights = [...deep, ...discovery.insights]
      .sort((a, b) => a.priority - b.priority)
      .slice(0, 5)
  }

  // Get yesterday's top insight if no record today (to maintain continuity)
  const yesterdayRecord = !todayRecord
    ? await prisma.dailyRecord.findFirst({
        where: {
          internshipId: internship.id,
          date: {
            lt: today,
            gte: new Date(today.getTime() - 86400000 * 3),
          },
        },
        orderBy: { date: "desc" },
        select: { summary: true, coachFeedback: true, date: true },
      })
    : null

  return NextResponse.json({
    data: {
      todayRecorded: !!todayRecord,
      currentDay,
      streakDays: streak,
      todayRecord: todayRecord
        ? {
            id: todayRecord.id,
            title: todayRecord.title,
            summary: todayRecord.summary,
            mood: todayRecord.mood,
            coachFeedback: todayRecord.coachFeedback,
            growthPoints: todayRecord.growthPoints,
            workItems: todayRecord.workItems.map((w) => ({
              id: w.id,
              title: w.title,
              type: w.type,
            })),
            knowledgeItems: todayRecord.knowledgeItems.map((k) => ({
              id: k.id,
              title: k.title,
              category: k.category,
            })),
            achievements: todayRecord.achievements.map((a) => ({
              id: a.id,
              title: a.title,
              icon: a.icon,
            })),
          }
        : null,
      growthMemory: growthMemory
        ? {
            summary: growthMemory.summary,
            skills: JSON.parse(growthMemory.skillsSnapshot),
            keyLearnings: JSON.parse(growthMemory.keyLearnings),
          }
        : null,
      discovery: {
        headline: discovery.headline,
        insights: deepInsights.slice(0, 5),
        skillChanges: discovery.skillChanges,
        nextAction: discovery.nextAction,
      },
      yesterdayRecord: yesterdayRecord
        ? {
            summary: yesterdayRecord.summary,
            date: yesterdayRecord.date,
          }
        : null,
    },
  })
}
