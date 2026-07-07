import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { handleApiError } from "@/lib/api-utils"

export async function GET(req: Request) {
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

    const knowledge = await prisma.knowledge.findMany({
      where: { record: { internshipId: { in: internshipIds } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    })

    const data = knowledge.map((k) => {
      let tags: string[] = []
      try { tags = JSON.parse(k.tags) } catch { /* corrupt data */ }
      let relatedIds: string[] = []
      try { if (k.relatedIds) relatedIds = JSON.parse(k.relatedIds) } catch { /* corrupt data */ }
      let prerequisiteIds: string[] = []
      try { if (k.prerequisiteIds) prerequisiteIds = JSON.parse(k.prerequisiteIds) } catch { /* corrupt data */ }
      return { ...k, tags, relatedIds, prerequisiteIds }
    })

    return NextResponse.json({ data })
  } catch (error) {
    return handleApiError(error, "GET /api/knowledge")
  }
}

export async function POST(req: Request) {
  try {
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
  } catch (error) {
    return handleApiError(error, "POST /api/knowledge")
  }
}
