import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const item = await prisma.knowledge.findUnique({
    where: { id },
    include: { record: { include: { internship: { select: { userId: true } } } } },
  })
  if (!item || item.record.internship.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const body = await req.json()
  const updated = await prisma.knowledge.update({
    where: { id },
    data: {
      category: body.category,
      title: body.title,
      content: body.content,
      source: body.source,
      tags: body.tags ? JSON.stringify(body.tags) : undefined,
      masteryLevel: body.masteryLevel,
    },
  })

  return NextResponse.json({ data: updated })
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const item = await prisma.knowledge.findUnique({
    where: { id },
    include: { record: { include: { internship: { select: { userId: true } } } } },
  })
  if (!item || item.record.internship.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  await prisma.knowledge.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
