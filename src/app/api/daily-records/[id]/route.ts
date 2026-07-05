import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const record = await prisma.dailyRecord.findUnique({
    where: { id },
    include: {
      workItems: true,
      knowledgeItems: true,
      achievements: true,
      internship: {
        select: { userId: true },
      },
    },
  })

  if (!record || record.internship.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json({ data: record })
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  // Verify ownership before deletion
  const record = await prisma.dailyRecord.findUnique({
    where: { id },
    include: { internship: { select: { userId: true } } },
  })

  if (!record || record.internship.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  await prisma.dailyRecord.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
