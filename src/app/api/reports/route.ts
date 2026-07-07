import { NextResponse } from "next/server"
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

    const reports = await prisma.report.findMany({
      where: { internshipId: { in: internships.map((i) => i.id) } },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ data: reports })
  } catch (error) {
    return handleApiError(error, "GET /api/reports")
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { type, title, format, dateRange, sections } = await req.json()

    const internship = await prisma.internship.findFirst({
      where: { userId: session.user.id, isActive: true },
      orderBy: { startDate: "desc" },
    })

    if (!internship) {
      return NextResponse.json(
        { error: "No active internship found" },
        { status: 400 }
      )
    }

    // Build date filter
    const dateFilter: Record<string, unknown> = { internshipId: internship.id }
    if (dateRange?.from || dateRange?.to) {
      const dateCondition: Record<string, Date> = {}
      if (dateRange.from) {
        dateCondition.gte = new Date(dateRange.from)
      }
      if (dateRange.to) {
        dateCondition.lte = new Date(dateRange.to)
      }
      if (Object.keys(dateCondition).length > 0) {
        dateFilter.date = dateCondition
      }
    }

    // Determine which sections to include
    const includeSections = (sections && sections.length > 0)
      ? sections
      : ["workItems", "knowledge", "achievements"]

    // Gather data for the report
    const records = await prisma.dailyRecord.findMany({
      where: dateFilter,
      orderBy: { date: "desc" },
      include: {
        workItems: true,
        knowledgeItems: true,
        achievements: true,
      },
    })

    if (records.length === 0) {
      return NextResponse.json(
        { error: "No records found. Complete daily records first." },
        { status: 400 }
      )
    }

    // Build markdown content
    let content = `# ${title}\n\n`
    content += `**实习生**：${session.user.name ?? "实习生"}\n`
    content += `**公司**：${internship.companyName}\n`
    content += `**岗位**：${internship.position}\n`
    content += `**生成时间**：${new Date().toLocaleDateString("zh-CN")}\n`

    if (dateRange?.from || dateRange?.to) {
      content += `**数据范围**：${dateRange.from ? new Date(dateRange.from).toLocaleDateString("zh-CN") : "最早记录"} 至 ${dateRange.to ? new Date(dateRange.to).toLocaleDateString("zh-CN") : "最新记录"}\n`
    }
    content += `\n---\n\n`

    content += `## 概述\n\n累计记录 ${records.length} 天。\n\n`

    if (includeSections.includes("workItems")) {
      content += `## 工作成果\n\n`
      const allTasks = records.flatMap((r) => r.workItems)
      if (allTasks.length > 0) {
        for (const task of allTasks.slice(0, 20)) {
          let tags: string[] = []
          try { tags = JSON.parse(task.tags) } catch { /* corrupt data */ }
          content += `- **${task.title}** (${task.type})${tags.length ? ` — ${tags.join(", ")}` : ""}\n`
        }
      } else {
        content += `暂无工作成果记录。\n`
      }
      content += `\n`
    }

    if (includeSections.includes("knowledge")) {
      content += `## 学习知识\n\n`
      const allKnowledge = records.flatMap((r) => r.knowledgeItems)
      if (allKnowledge.length > 0) {
        for (const k of allKnowledge.slice(0, 20)) {
          content += `- **${k.title}** (${k.category}) — ${k.content.slice(0, 100)}\n`
        }
      } else {
        content += `暂无学习知识记录。\n`
      }
      content += `\n`
    }

    if (includeSections.includes("achievements")) {
      content += `## 成就\n\n`
      const allAchievements = records.flatMap((r) => r.achievements)
      if (allAchievements.length > 0) {
        for (const a of allAchievements.slice(0, 10)) {
          content += `- ${a.icon ?? "⭐"} ${a.title}\n`
        }
      } else {
        content += `暂无成就记录。\n`
      }
      content += `\n`
    }

    const report = await prisma.report.create({
      data: {
        internshipId: internship.id,
        type,
        title,
        format,
        status: "COMPLETED",
        content,
      },
    })

    return NextResponse.json({ data: report })
  } catch (error) {
    return handleApiError(error, "POST /api/reports")
  }
}
