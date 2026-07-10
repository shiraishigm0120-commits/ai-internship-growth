import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { resolveUserAI } from "@/lib/ai-provider"
import { extractDataFromConversation, generateCoachFeedback } from "@/lib/ai/extraction"
import { generateGrowthMemory, saveGrowthMemory } from "@/lib/ai/growth-memory"
import { handleApiError } from "@/lib/api-utils"
import { syncFunnelToFeishu } from "@/lib/feishu"
import type { ExtractedData } from "@/types"

export async function GET(req: Request) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const internshipId = searchParams.get("internshipId")

    if (!internshipId) {
      return NextResponse.json({ error: "internshipId required" }, { status: 400 })
    }

    const records = await prisma.dailyRecord.findMany({
      where: { internshipId },
      orderBy: { date: "desc" },
      take: 30,
      include: {
        workItems: true,
        knowledgeItems: true,
        achievements: true,
      },
    })

    return NextResponse.json({ data: records })
  } catch (error) {
    return handleApiError(error, "GET /api/daily-records")
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { internshipId, conversation, mood, hoursWorked, extracted: preExtracted } = await req.json()

    if (!internshipId || !conversation) {
      return NextResponse.json(
        { error: "internshipId and conversation required" },
        { status: 400 }
      )
    }

    // Verify internship belongs to user
    const internship = await prisma.internship.findFirst({
      where: { id: internshipId, userId: session.user.id },
    })

    if (!internship) {
      return NextResponse.json({ error: "Internship not found" }, { status: 404 })
    }

    // Check if user has their own API key (real AI) or demo mode
    const { client: openai, model, isReal } = await resolveUserAI(session.user.id)

    // Use pre-extracted data if available, otherwise run AI extraction (only for real AI users)
    const extracted: ExtractedData = isReal
      ? (preExtracted ?? await extractDataFromConversation(conversation, openai, model))
      : { workItems: [], knowledge: [], achievements: [], skills: [], summary: conversation[conversation.length - 1]?.content?.slice(0, 100) ?? "" }

    // Generate coach feedback (only for real AI users)
    const coachFeedbackPromise = isReal
      ? generateCoachFeedback(conversation, extracted.summary ?? "", openai, model)
      : Promise.resolve(null as string | null)

    // Skip growth memory for demo users
    const growthMemoryPromise = isReal
      ? (async () => {
          const gm = await generateGrowthMemory(session.user.id, conversation, {
            skills: extracted.skills,
            achievements: extracted.achievements,
          }, openai, model)
          if (gm) await saveGrowthMemory(session.user.id, gm)
        })()
      : Promise.resolve()

    // Calculate word count
    const wordCount = conversation
      .filter((m: { role: string }) => m.role === "user")
      .reduce((sum: number, m: { content: string }) => sum + m.content.length, 0)

    // Create daily record with all extracted data (in transaction)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Await coach feedback before transaction
    const coachFeedback = await coachFeedbackPromise

    // Build growth points from skill changes
    const growthPoints = extracted.skillChanges?.map((sc) => ({
      skill: sc.name,
      points: sc.to - sc.from,
    })) ?? []

    const record = await prisma.$transaction(async (tx) => {
      // Upsert to handle same-day re-saves
      const existing = await tx.dailyRecord.findUnique({
        where: { internshipId_date: { internshipId, date: today } },
      })

      if (existing) {
        // Delete old child records and replace
        await tx.workItem.deleteMany({ where: { recordId: existing.id } })
        await tx.knowledge.deleteMany({ where: { recordId: existing.id } })
        await tx.achievement.deleteMany({ where: { recordId: existing.id } })
      }

      const record = existing
        ? await tx.dailyRecord.update({
            where: { id: existing.id },
            data: {
              title: extracted.summary.slice(0, 100),
              conversation: JSON.stringify(conversation),
              summary: extracted.summary,
              mood: extracted.mood ?? mood,
              hoursWorked,
              wordCount,
              coachFeedback,
              growthPoints: JSON.stringify(growthPoints),
              reflection: extracted.reflection,
            },
          })
        : await tx.dailyRecord.create({
            data: {
              internshipId,
              date: today,
              title: extracted.summary.slice(0, 100),
              conversation: JSON.stringify(conversation),
              summary: extracted.summary,
              mood: extracted.mood ?? mood,
              hoursWorked,
              wordCount,
              coachFeedback,
              growthPoints: JSON.stringify(growthPoints),
              reflection: extracted.reflection,
            },
          })

      // Create child records
      await tx.workItem.createMany({
        data: extracted.workItems.map((item) => ({
          recordId: record.id,
          type: item.type,
          title: item.title,
          description: item.description,
          status: item.status,
          priority: item.priority,
          tags: JSON.stringify(item.tags),
          effort: item.effort,
        })),
      })

      await tx.knowledge.createMany({
        data: extracted.knowledge.map((k) => ({
          recordId: record.id,
          category: k.category,
          title: k.title,
          content: k.content,
          source: k.source,
          tags: JSON.stringify(k.tags),
          masteryLevel: k.masteryLevel,
        })),
      })

      await tx.achievement.createMany({
        data: extracted.achievements.map((a) => ({
          recordId: record.id,
          title: a.title,
          description: a.description,
          category: a.category,
          icon: a.icon,
          value: a.value,
          unit: a.unit,
        })),
      })

      // Update tags
      for (const skill of extracted.skills) {
        const existingTag = await tx.tag.findUnique({ where: { name: skill } })
        if (existingTag) {
          await tx.tag.update({ where: { name: skill }, data: { usageCount: { increment: 1 } } })
        } else {
          await tx.tag.create({ data: { name: skill, category: "skill" } })
        }
      }

      // Save funnel data if any funnel numbers were extracted
      if (extracted.funnel) {
        const f = extracted.funnel
        const hasFunnelData = (f.totalApplications ?? 0) > 0 || (f.passedScreening ?? 0) > 0 || (f.passedBusinessReview ?? 0) > 0 || (f.interviewAttendees ?? 0) > 0 || (f.offersSent ?? 0) > 0 || (f.offersAccepted ?? 0) > 0 || (f.onboarded ?? 0) > 0
        if (hasFunnelData) {
          const funnelExisting = await tx.recruitmentFunnel.findUnique({
            where: { internshipId_date: { internshipId, date: today } },
          })
          if (funnelExisting) {
            await tx.recruitmentFunnel.update({
              where: { id: funnelExisting.id },
              data: {
                totalApplications: f.totalApplications ?? funnelExisting.totalApplications,
                passedScreening: f.passedScreening ?? funnelExisting.passedScreening,
                passedBusinessReview: f.passedBusinessReview ?? funnelExisting.passedBusinessReview,
                interviewAttendees: f.interviewAttendees ?? funnelExisting.interviewAttendees,
                offersSent: f.offersSent ?? funnelExisting.offersSent,
                offersAccepted: f.offersAccepted ?? funnelExisting.offersAccepted,
                onboarded: f.onboarded ?? funnelExisting.onboarded,
              },
            })
          } else {
            await tx.recruitmentFunnel.create({
              data: {
                internshipId,
                date: today,
                totalApplications: f.totalApplications ?? 0,
                passedScreening: f.passedScreening ?? 0,
                passedBusinessReview: f.passedBusinessReview ?? 0,
                interviewAttendees: f.interviewAttendees ?? 0,
                offersSent: f.offersSent ?? 0,
                offersAccepted: f.offersAccepted ?? 0,
                onboarded: f.onboarded ?? 0,
                note: "AI从今日对话自动提取",
              },
            })
          }
        }
      }

      return record
    })

    // Sync today's funnel to Feishu (non-critical, after transaction)
    const savedFunnel = await prisma.recruitmentFunnel.findUnique({
      where: { internshipId_date: { internshipId, date: today } },
    })
    if (savedFunnel) {
      await syncFunnelToFeishu(today, {
        totalApplications: savedFunnel.totalApplications,
        passedScreening: savedFunnel.passedScreening,
        passedBusinessReview: savedFunnel.passedBusinessReview,
        interviewAttendees: savedFunnel.interviewAttendees,
        offersSent: savedFunnel.offersSent,
        offersAccepted: savedFunnel.offersAccepted,
        onboarded: savedFunnel.onboarded,
        note: savedFunnel.note ?? undefined,
      })
    }

    // Fetch with relations
    const fullRecord = await prisma.dailyRecord.findUnique({
      where: { id: record.id },
      include: { workItems: true, knowledgeItems: true, achievements: true },
    })

    return NextResponse.json({ data: fullRecord, extracted })
  } catch (error) {
    return handleApiError(error, "POST /api/daily-records")
  }
}
