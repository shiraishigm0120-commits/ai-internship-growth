import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { handleApiError } from "@/lib/api-utils"

// POST — import records from JSON
export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const internship = await prisma.internship.findFirst({
      where: { userId: session.user.id, isActive: true },
    })

    if (!internship) {
      return NextResponse.json(
        { error: "No active internship found" },
        { status: 400 }
      )
    }

    const body = await req.json()
    const records = body.records as Array<{
      date: string
      title?: string
      summary?: string
      mood?: string
      workItems?: { type: string; title: string; description?: string; tags?: string[] }[]
      knowledgeItems?: { category: string; title: string; content: string; tags?: string[] }[]
    }>

    if (!Array.isArray(records) || records.length === 0) {
      return NextResponse.json({ error: "No valid records provided" }, { status: 400 })
    }

    let imported = 0
    for (const r of records) {
      if (!r.date) continue

      await prisma.dailyRecord.upsert({
        where: {
          internshipId_date: {
            internshipId: internship.id,
            date: new Date(r.date),
          },
        },
        create: {
          internshipId: internship.id,
          date: new Date(r.date),
          title: r.title ?? r.summary?.slice(0, 100),
          summary: r.summary,
          mood: r.mood ?? "neutral",
          conversation: JSON.stringify([
            { role: "user", content: `导入记录：${r.summary ?? r.date}` },
            { role: "assistant", content: "记录已导入" },
          ]),
          workItems: {
            create: (r.workItems ?? []).map((w) => ({
              type: w.type ?? "task",
              title: w.title,
              description: w.description,
              tags: JSON.stringify(w.tags ?? []),
              status: "completed",
            })),
          },
          knowledgeItems: {
            create: (r.knowledgeItems ?? []).map((k) => ({
              category: k.category ?? "technical",
              title: k.title,
              content: k.content,
              tags: JSON.stringify(k.tags ?? []),
              masteryLevel: "learning",
            })),
          },
        },
        update: {
          title: r.title ?? r.summary?.slice(0, 100),
          summary: r.summary,
        },
      })
      imported++
    }

    return NextResponse.json({
      data: { imported, message: `成功导入 ${imported} 条记录` },
    })
  } catch (error) {
    return handleApiError(error, "POST /api/import")
  }
}
