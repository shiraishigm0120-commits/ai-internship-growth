import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { handleApiError } from "@/lib/api-utils"
import { getRecruitmentStats, recruitmentCareerCapital } from "@/lib/recruitment-stats"

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const internships = await prisma.internship.findMany({
      where: { userId: session.user.id },
      select: { id: true },
    })
    const internshipIds = internships.map((i) => i.id)

    // Batch all independent queries
    const [milestones, growthMemories, skills, records] = await Promise.all([
      prisma.milestone.findMany({
        where: { userId: session.user.id },
        orderBy: { date: "desc" },
        take: 30,
      }),
      prisma.growthMemory.findMany({
        where: { userId: session.user.id },
        orderBy: { date: "asc" },
        select: { date: true, skillsSnapshot: true, careerCapital: true },
        take: 90,
      }),
      // Current skills from Skill table — source of truth
      prisma.skill.findMany({
        where: { userId: session.user.id },
        orderBy: { level: "desc" },
      }),
      prisma.dailyRecord.findMany({
        where: { internshipId: { in: internshipIds } },
        orderBy: { date: "asc" },
        select: { date: true, wordCount: true },
      }),
    ])

    // Build skill timeline from growth memories (historical snapshots)
    const skillTimeline = growthMemories.map((gm) => {
      let skills: { name: string; level: number }[] = []
      try {
        const parsed = JSON.parse(gm.skillsSnapshot)
        if (Array.isArray(parsed)) {
          skills = parsed
        } else if (parsed && typeof parsed === "object") {
          skills = Object.entries(parsed).map(([name, level]) => ({
            name,
            level: typeof level === "number" ? level : 0,
          }))
        }
      } catch { /* corrupt data */ }
      return {
        date: gm.date.toISOString().slice(0, 10),
        skills,
      }
    })

    // Career capital from latest memory
    const latestMemory = growthMemories[growthMemories.length - 1]
    let careerCapital: { category: string; count: number; unit: string }[] = []
    if (latestMemory) {
      try {
        const parsed = JSON.parse(latestMemory.careerCapital)
        if (Array.isArray(parsed)) {
          careerCapital = parsed
        } else if (parsed && typeof parsed === "object") {
          careerCapital = Object.entries(parsed).map(([category, count]) => ({
            category,
            count: typeof count === "number" ? count : 0,
            unit: "",
          }))
        }
      } catch { /* corrupt data */ }
    }

    // Overlay authoritative recruitment counts onto the AI-derived career
    // capital (recruitment numbers computed from the DB are exact and win).
    // Non-fatal: never let the recruitment overlay break the whole timeline.
    try {
      const activeInternship = await prisma.internship.findFirst({
        where: { userId: session.user.id, isActive: true },
        select: { id: true },
      })
      if (activeInternship) {
        const recCapital = recruitmentCareerCapital(await getRecruitmentStats(activeInternship.id))
        if (recCapital.length > 0) {
          const byCategory = new Map(careerCapital.map((c) => [c.category, c]))
          for (const rc of recCapital) byCategory.set(rc.category, rc)
          careerCapital = Array.from(byCategory.values())
        }
      }
    } catch (e) {
      console.error("Recruitment career-capital overlay failed (non-fatal):", e)
    }

    // Current skills from Skill table (queryable source of truth)
    const currentSkills = skills.map((s) => ({
      name: s.name,
      level: s.level,
      category: s.category,
      trend: s.trend,
      evidenceCount: s.evidenceCount,
    }))

    const activityData = records.map((r) => ({
      date: r.date.toISOString().slice(0, 10),
      wordCount: r.wordCount,
    }))

    // Calculate streaks
    let currentStreak = 0
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const sortedDates = records
      .map((r) => {
        const d = new Date(r.date)
        d.setHours(0, 0, 0, 0)
        return d.getTime()
      })
      .sort((a, b) => b - a)

    for (let i = 0; i < sortedDates.length; i++) {
      const expected = today.getTime() - i * 86400000
      if (sortedDates[i] === expected) {
        currentStreak++
      } else {
        break
      }
    }

    return NextResponse.json({
      data: {
        milestones: milestones.map((m) => ({
          id: m.id,
          title: m.title,
          description: m.description,
          icon: m.icon,
          date: m.date,
          category: m.category,
          recordId: m.recordId,
        })),
        skillTimeline,
        currentSkills,
        careerCapital,
        activityData,
        currentStreak,
        totalDays: records.length,
        totalMilestones: milestones.length,
      },
    })
  } catch (error) {
    return handleApiError(error, "GET /api/stats/timeline")
  }
}
