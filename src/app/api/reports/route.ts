import { NextResponse } from "next/server"
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

  const reports = await prisma.report.findMany({
    where: { internshipId: { in: internships.map((i) => i.id) } },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json({ data: reports })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { type, title, format } = await req.json()

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

  // Gather data for the report
  const records = await prisma.dailyRecord.findMany({
    where: { internshipId: internship.id },
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
  content += `**生成时间**：${new Date().toLocaleDateString("zh-CN")}\n\n`
  content += `---\n\n`

  content += `## 概述\n\n累计记录 ${records.length} 天。\n\n`

  content += `## 工作成果\n\n`
  const allTasks = records.flatMap((r) => r.workItems)
  for (const task of allTasks.slice(0, 20)) {
    const tags = JSON.parse(task.tags) as string[]
    content += `- **${task.title}** (${task.type})${tags.length ? ` — ${tags.join(", ")}` : ""}\n`
  }
  content += `\n`

  content += `## 学习知识\n\n`
  const allKnowledge = records.flatMap((r) => r.knowledgeItems)
  for (const k of allKnowledge.slice(0, 20)) {
    content += `- **${k.title}** (${k.category}) — ${k.content.slice(0, 100)}\n`
  }
  content += `\n`

  content += `## 成就\n\n`
  const allAchievements = records.flatMap((r) => r.achievements)
  for (const a of allAchievements.slice(0, 10)) {
    content += `- ${a.icon ?? "⭐"} ${a.title}\n`
  }
  content += `\n`

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
}
