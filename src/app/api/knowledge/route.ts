import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const internships = await prisma.internship.findMany({
    where: { userId: session.user.id },
    select: { id: true },
  })

  const internshipIds = internships.map((i) => i.id)

  const knowledge = await prisma.knowledge.findMany({
    where: { record: { internshipId: { in: internshipIds } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  })

  return NextResponse.json({ data: knowledge })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { recordId, category, title, content, source, tags, masteryLevel } = await req.json()

  if (!recordId || !title || !category) {
    return NextResponse.json({ error: "recordId, title, and category are required" }, { status: 400 })
  }

  // Verify record belongs to user
  const record = await prisma.dailyRecord.findUnique({
    where: { id: recordId },
    include: { internship: { select: { userId: true } } },
  })
  if (!record || record.internship.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const item = await prisma.knowledge.create({
    data: {
      recordId,
      category: category ?? "other",
      title,
      content: content ?? "",
      source,
      tags: JSON.stringify(tags ?? []),
      masteryLevel: masteryLevel ?? "beginner",
    },
  })

  return NextResponse.json({ data: item }, { status: 201 })
}
