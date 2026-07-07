import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { handleApiError } from "@/lib/api-utils"

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

    const cases = await prisma.sTARCase.findMany({
      where: { internshipId: { in: internships.map((i) => i.id) } },
      orderBy: { createdAt: "desc" },
    })

    const data = cases.map((c) => {
      let skills: string[] = []
      let tags: string[] = []
      try { skills = JSON.parse(c.skills) } catch { /* corrupt data */ }
      try { tags = JSON.parse(c.tags) } catch { /* corrupt data */ }
      return {
        ...c,
        skills,
        tags,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      }
    })

    return NextResponse.json({ data })
  } catch (error) {
    return handleApiError(error, "GET /api/star-cases")
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await req.json()
    const { internshipId, title, situation, task, action, result, skills, tags, impact, isAiGenerated } = body

    const internship = await prisma.internship.findUnique({
      where: { id: internshipId },
      select: { userId: true },
    })
    if (!internship || internship.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const starCase = await prisma.sTARCase.create({
      data: {
        internshipId,
        title,
        situation,
        task,
        action,
        result,
        skills: JSON.stringify(skills ?? []),
        tags: JSON.stringify(tags ?? []),
        impact,
        isAiGenerated: isAiGenerated ?? false,
        isVerified: false,
        starRating: 0,
      },
    })

    let parsedSkills: string[] = []
    let parsedTags: string[] = []
    try { parsedSkills = JSON.parse(starCase.skills) } catch { /* corrupt data */ }
    try { parsedTags = JSON.parse(starCase.tags) } catch { /* corrupt data */ }

    return NextResponse.json({
      data: {
        ...starCase,
        skills: parsedSkills,
        tags: parsedTags,
        createdAt: starCase.createdAt.toISOString(),
        updatedAt: starCase.updatedAt.toISOString(),
      },
    }, { status: 201 })
  } catch (error) {
    return handleApiError(error, "POST /api/star-cases")
  }
}
