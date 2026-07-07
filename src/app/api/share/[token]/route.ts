import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { handleApiError } from "@/lib/api-utils"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    const shareLink = await prisma.shareLink.findUnique({
      where: { token },
      include: { user: true },
    })

    if (!shareLink || shareLink.expiresAt < new Date()) {
      return NextResponse.json({ error: "分享链接已失效" }, { status: 404 })
    }

    // Gather public timeline data
    const internships = await prisma.internship.findMany({
      where: { userId: shareLink.userId },
    })

    const internshipIds = internships.map((i) => i.id)

    const [records, milestones, latestMemory] = await Promise.all([
      prisma.dailyRecord.count({ where: { internshipId: { in: internshipIds } } }),
      prisma.milestone.findMany({
        where: { userId: shareLink.userId },
        orderBy: { date: "desc" },
        take: 20,
      }),
      prisma.growthMemory.findFirst({
        where: { userId: shareLink.userId },
        orderBy: { date: "desc" },
      }),
    ])

    let skills: { name: string; level: number }[] = []
    let careerCapital: { category: string; count: number; unit: string }[] = []

    if (latestMemory) {
      try { skills = JSON.parse(latestMemory.skillsSnapshot) } catch {}
      try { careerCapital = JSON.parse(latestMemory.careerCapital) } catch {}
    }

    const activeInternship = internships.find((i) => i.isActive)

    return NextResponse.json({
      data: {
        milestones,
        skills,
        careerCapital,
        totalDays: records,
        currentStreak: 0, // simplified for public view
        totalMilestones: milestones.length,
        userName: shareLink.user.name ?? "实习生",
        companyName: activeInternship?.companyName ?? "",
        position: activeInternship?.position ?? "",
      },
    })
  } catch (error) {
    return handleApiError(error, "GET /api/share/[token]")
  }
}
