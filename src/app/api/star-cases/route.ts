import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
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

  const data = cases.map((c) => ({
    ...c,
    skills: JSON.parse(c.skills) as string[],
    tags: JSON.parse(c.tags) as string[],
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }))

  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
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

  return NextResponse.json({
    data: {
      ...starCase,
      skills: JSON.parse(starCase.skills),
      tags: JSON.parse(starCase.tags),
      createdAt: starCase.createdAt.toISOString(),
      updatedAt: starCase.updatedAt.toISOString(),
    },
  }, { status: 201 })
}
