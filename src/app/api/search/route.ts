import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { handleApiError } from "@/lib/api-utils"

const MAX_PER_CATEGORY = 5

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const q = searchParams.get("q")?.trim()

    if (!q || q.length < 1) {
      return NextResponse.json({
        records: [],
        knowledge: [],
        starCases: [],
        tasks: [],
      })
    }

    // Get user's internship IDs
    const internships = await prisma.internship.findMany({
      where: { userId: session.user.id },
      select: { id: true },
    })
    const internshipIds = internships.map((i) => i.id)

    if (internshipIds.length === 0) {
      return NextResponse.json({
        records: [],
        knowledge: [],
        starCases: [],
        tasks: [],
      })
    }

    // Search all categories in parallel
    const [records, knowledge, starCases, tasks] = await Promise.all([
      prisma.dailyRecord.findMany({
        where: {
          internshipId: { in: internshipIds },
          OR: [
            { title: { contains: q } },
            { summary: { contains: q } },
          ],
        },
        select: {
          id: true,
          title: true,
          summary: true,
          date: true,
          internshipId: true,
          internship: { select: { companyName: true } },
        },
        orderBy: { date: "desc" },
        take: MAX_PER_CATEGORY,
      }),
      prisma.knowledge.findMany({
        where: {
          record: { internshipId: { in: internshipIds } },
          OR: [
            { title: { contains: q } },
            { content: { contains: q } },
          ],
        },
        select: {
          id: true,
          title: true,
          content: true,
          category: true,
          recordId: true,
        },
        orderBy: { createdAt: "desc" },
        take: MAX_PER_CATEGORY,
      }),
      prisma.sTARCase.findMany({
        where: {
          internshipId: { in: internshipIds },
          OR: [
            { title: { contains: q } },
            { action: { contains: q } },
          ],
        },
        select: {
          id: true,
          title: true,
          action: true,
          internshipId: true,
        },
        orderBy: { createdAt: "desc" },
        take: MAX_PER_CATEGORY,
      }),
      prisma.task.findMany({
        where: {
          internshipId: { in: internshipIds },
          title: { contains: q },
        },
        select: {
          id: true,
          title: true,
          status: true,
          internshipId: true,
        },
        orderBy: { createdAt: "desc" },
        take: MAX_PER_CATEGORY,
      }),
    ])

    return NextResponse.json({
      records: records.map((r) => ({
        ...r,
        date: r.date.toISOString(),
        companyName: r.internship.companyName,
        internship: undefined,
      })),
      knowledge: knowledge.map((k) => ({
        ...k,
        snippet: k.content.length > 120 ? k.content.slice(0, 120) + "..." : k.content,
      })),
      starCases: starCases.map((s) => ({
        ...s,
        snippet: s.action.length > 120 ? s.action.slice(0, 120) + "..." : s.action,
      })),
      tasks: tasks.map((t) => ({
        ...t,
        statusLabel:
          t.status === "completed"
            ? "已完成"
            : t.status === "in_progress"
              ? "进行中"
              : "待开始",
      })),
    })
  } catch (error) {
    return handleApiError(error, "GET /api/search")
  }
}
