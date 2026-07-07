import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { handleApiError } from "@/lib/api-utils"

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get latest growth memory
    const memory = await prisma.growthMemory.findFirst({
      where: { userId: session.user.id },
      orderBy: { date: "desc" },
    })

    if (!memory) {
      return NextResponse.json({ data: null })
    }

    // Safe parse growth memory JSON fields
    let skills: unknown = null
    let openChallenges: unknown = null
    let keyLearnings: unknown = null
    let careerCapital: unknown = null
    try { skills = JSON.parse(memory.skillsSnapshot) } catch { /* corrupt data */ }
    try { openChallenges = JSON.parse(memory.openChallenges) } catch { /* corrupt data */ }
    try { keyLearnings = JSON.parse(memory.keyLearnings) } catch { /* corrupt data */ }
    try { careerCapital = JSON.parse(memory.careerCapital) } catch { /* corrupt data */ }

    return NextResponse.json({
      data: {
        id: memory.id,
        summary: memory.summary,
        skills,
        openChallenges,
        keyLearnings,
        isMilestone: memory.isMilestone,
        milestoneTitle: memory.milestoneTitle,
        milestoneIcon: memory.milestoneIcon,
        careerCapital,
        date: memory.date,
      },
    })
  } catch (error) {
    return handleApiError(error, "GET /api/growth-memory")
  }
}
