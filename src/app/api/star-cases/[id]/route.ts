import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const starCase = await prisma.sTARCase.findUnique({
    where: { id },
    include: { internship: { select: { userId: true } } },
  })
  if (!starCase || starCase.internship.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json({
    data: {
      ...starCase,
      skills: JSON.parse(starCase.skills),
      tags: JSON.parse(starCase.tags),
      createdAt: starCase.createdAt.toISOString(),
      updatedAt: starCase.updatedAt.toISOString(),
    },
  })
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const starCase = await prisma.sTARCase.findUnique({
    where: { id },
    include: { internship: { select: { userId: true } } },
  })
  if (!starCase || starCase.internship.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const body = await req.json()
  const updated = await prisma.sTARCase.update({
    where: { id },
    data: {
      title: body.title,
      situation: body.situation,
      task: body.task,
      action: body.action,
      result: body.result,
      skills: body.skills ? JSON.stringify(body.skills) : undefined,
      tags: body.tags ? JSON.stringify(body.tags) : undefined,
      impact: body.impact,
      isVerified: body.isVerified,
      starRating: body.starRating,
    },
  })

  return NextResponse.json({
    data: {
      ...updated,
      skills: JSON.parse(updated.skills),
      tags: JSON.parse(updated.tags),
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    },
  })
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const starCase = await prisma.sTARCase.findUnique({
    where: { id },
    include: { internship: { select: { userId: true } } },
  })
  if (!starCase || starCase.internship.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  await prisma.sTARCase.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
