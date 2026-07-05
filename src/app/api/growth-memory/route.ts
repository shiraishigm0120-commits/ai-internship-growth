import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
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

  return NextResponse.json({
    data: {
      id: memory.id,
      summary: memory.summary,
      skills: JSON.parse(memory.skillsSnapshot),
      openChallenges: JSON.parse(memory.openChallenges),
      keyLearnings: JSON.parse(memory.keyLearnings),
      isMilestone: memory.isMilestone,
      milestoneTitle: memory.milestoneTitle,
      milestoneIcon: memory.milestoneIcon,
      careerCapital: JSON.parse(memory.careerCapital),
      date: memory.date,
    },
  })
}
