import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { handleApiError } from "@/lib/api-utils"

type ExportType = "records" | "starCases" | "knowledge" | "reports" | "all"
type ExportFormat = "json" | "csv" | "pdf"

function escapeCsvValue(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`
  }
  return val
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return ""
  const headers = Object.keys(rows[0])
  const headerLine = headers.map(escapeCsvValue).join(",")
  const dataLines = rows.map((row) =>
    headers.map((h) => {
      const val = row[h]
      if (val === null || val === undefined) return ""
      return escapeCsvValue(String(val))
    }).join(",")
  )
  return [headerLine, ...dataLines].join("\n")
}

// Simple markdown-to-HTML for report content
function mdToHtml(md: string): string {
  return md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^\- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, "<ul>$&</ul>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br>")
}

function buildHtmlReport(data: {
  title: string
  exportedAt: string
  exportedBy: string
  sections: { heading: string; items: { label: string; value: string }[][] }[]
}): string {
  const sectionsHtml = data.sections.map((section) => {
    if (section.items.length === 0) return ""
    const cards = section.items.map((fields) => {
      const rows = fields
        .filter((f) => f.value.trim())
        .map((f) => {
          if (f.label) {
            return `<div class="field"><span class="label">${f.label}</span><span class="value">${f.value}</span></div>`
          }
          return `<div class="field full">${f.value}</div>`
        })
        .join("")
      return `<div class="card">${rows}</div>`
    }).join("")
    return `<h2 class="section-heading">${section.heading}</h2>${cards}`
  }).join("")

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${data.title}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif;
    font-size: 14px;
    line-height: 1.7;
    color: #1a1a1a;
    background: #fff;
    max-width: 800px;
    margin: 0 auto;
    padding: 40px 24px;
  }
  h1 {
    font-size: 24px;
    margin-bottom: 4px;
  }
  .meta {
    font-size: 12px;
    color: #888;
    margin-bottom: 32px;
  }
  .section-heading {
    font-size: 18px;
    margin: 28px 0 12px;
    padding-bottom: 8px;
    border-bottom: 2px solid #e5e5e5;
    color: #333;
  }
  .card {
    border: 1px solid #eee;
    border-radius: 8px;
    padding: 14px 16px;
    margin-bottom: 10px;
    background: #fafafa;
  }
  .field {
    display: flex;
    gap: 8px;
    margin-bottom: 4px;
    font-size: 13px;
  }
  .field:last-child { margin-bottom: 0; }
  .field.full { display: block; }
  .label {
    color: #666;
    font-weight: 500;
    flex-shrink: 0;
    min-width: 60px;
  }
  .label::after { content: "："; }
  .value { color: #333; }
  h2, h3 { margin: 8px 0 4px; font-size: 15px; }
  ul { padding-left: 20px; margin: 4px 0; }
  li { margin-bottom: 2px; }
  strong { color: #222; }
  p { margin-bottom: 6px; }

  @media print {
    body { padding: 0; font-size: 12px; }
    .card { border-color: #ddd; break-inside: avoid; }
    .section-heading { break-after: avoid; }
  }
</style>
</head>
<body>
<h1>${data.title}</h1>
<p class="meta">导出时间：${data.exportedAt} &nbsp;|&nbsp; 导出用户：${data.exportedBy}</p>
${sectionsHtml}
</body>
</html>`
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const type: ExportType = body.type ?? "all"
    const format: ExportFormat = body.format ?? "json"

    const internships = await prisma.internship.findMany({
      where: { userId: session.user.id },
      select: { id: true },
    })
    const internshipIds = internships.map((i) => i.id)

    let records: Record<string, unknown>[] = []
    let starCases: Record<string, unknown>[] = []
    let knowledgeItems: Record<string, unknown>[] = []
    let reports: Record<string, unknown>[] = []

    // ── Fetch records ──
    if (type === "records" || type === "all") {
      const data = await prisma.dailyRecord.findMany({
        where: { internshipId: { in: internshipIds } },
        orderBy: { date: "desc" },
        include: {
          workItems: { select: { title: true, type: true } },
          achievements: { select: { title: true, icon: true } },
        },
      })
      records = data.map((r) => ({
        日期: r.date.toISOString().split("T")[0],
        标题: r.title ?? "",
        摘要: r.summary ?? "",
        心情: r.mood ?? "",
        工作时长: r.hoursWorked ?? "",
        字数: r.wordCount,
        工作项: r.workItems.map((w) => w.title).join("；"),
        成就: r.achievements.map((a) => `${a.icon ?? ""}${a.title}`).join("；"),
        Coach反馈: r.coachFeedback ?? "",
      }))
    }

    // ── Fetch STAR cases ──
    if (type === "starCases" || type === "all") {
      const data = await prisma.sTARCase.findMany({
        where: { internshipId: { in: internshipIds } },
        orderBy: { createdAt: "desc" },
      })
      starCases = data.map((c) => {
        let skills: string[] = []
        try { skills = JSON.parse(c.skills) } catch { /* ignore */ }
        return {
          标题: c.title,
          情境: c.situation,
          任务: c.task,
          行动: c.action,
          结果: c.result,
          技能: skills.join("、"),
          影响力: c.impact ?? "",
          已验证: c.isVerified ? "是" : "否",
          评分: c.starRating,
          创建时间: c.createdAt.toISOString().split("T")[0],
        }
      })
    }

    // ── Fetch knowledge ──
    if (type === "knowledge" || type === "all") {
      const data = await prisma.knowledge.findMany({
        where: { record: { internshipId: { in: internshipIds } } },
        orderBy: { createdAt: "desc" },
      })
      knowledgeItems = data.map((k) => {
        let tags: string[] = []
        try { tags = JSON.parse(k.tags) } catch { /* ignore */ }
        return {
          标题: k.title,
          内容: k.content,
          分类: k.category,
          标签: tags.join("、"),
          掌握程度: k.masteryLevel,
          来源: k.source ?? "",
          已收藏: k.isBookmarked ? "是" : "否",
        }
      })
    }

    // ── Fetch reports ──
    if (type === "reports" || type === "all") {
      const data = await prisma.report.findMany({
        where: { internshipId: { in: internshipIds } },
        orderBy: { createdAt: "desc" },
      })
      reports = data.map((r) => ({
        标题: r.title,
        类型: r.type,
        格式: r.format,
        状态: r.status,
        内容: (r.content ?? "").slice(0, 2000),
        创建时间: r.createdAt.toISOString().split("T")[0],
      }))
    }

    const now = new Date().toISOString().replace("T", " ").slice(0, 19)
    const userName = session.user.name ?? session.user.email ?? "未知用户"

    const typeLabel: Record<ExportType, string> = {
      records: "每日记录",
      starCases: "STAR 案例",
      knowledge: "知识库",
      reports: "报告",
      all: "全部数据",
    }

    // ── JSON ──
    if (format === "json") {
      const exportData = {
        exportedAt: now,
        exportedBy: userName,
        ...(records.length > 0 ? { records } : {}),
        ...(starCases.length > 0 ? { starCases } : {}),
        ...(knowledgeItems.length > 0 ? { knowledge: knowledgeItems } : {}),
        ...(reports.length > 0 ? { reports } : {}),
      }
      const jsonStr = JSON.stringify(exportData, null, 2)
      return new NextResponse(jsonStr, {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="export_${type}_${Date.now()}.json"`,
        },
      })
    }

    // ── CSV ──
    if (format === "csv") {
      const csvParts: string[] = []
      if (records.length > 0) {
        csvParts.push("# 每日记录")
        csvParts.push(toCsv(records))
        csvParts.push("")
      }
      if (starCases.length > 0) {
        csvParts.push("# STAR 案例")
        csvParts.push(toCsv(starCases))
        csvParts.push("")
      }
      if (knowledgeItems.length > 0) {
        csvParts.push("# 知识库")
        csvParts.push(toCsv(knowledgeItems))
        csvParts.push("")
      }
      if (reports.length > 0) {
        csvParts.push("# 报告")
        csvParts.push(toCsv(reports))
        csvParts.push("")
      }
      const csv = "﻿" + csvParts.join("\n")
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="export_${type}_${Date.now()}.csv"`,
        },
      })
    }

    // ── PDF → 改为生成可打印的 HTML 报告 ──
    // jsPDF 默认字体不支持中文，嵌入 CJK 字体文件过大（5-15MB），
    // 此处生成自包含 HTML 文档，用户可在浏览器中打开并打印为 PDF。
    if (format === "pdf") {
      const sections: { heading: string; items: { label: string; value: string }[][] }[] = []

      if (records.length > 0) {
        sections.push({
          heading: "每日记录",
          items: records.map((r) => [
            { label: "日期", value: String(r["日期"] ?? "") },
            { label: "标题", value: String(r["标题"] ?? "") },
            { label: "摘要", value: String(r["摘要"] ?? "") },
            { label: "工作项", value: String(r["工作项"] ?? "") },
            { label: "成就", value: String(r["成就"] ?? "") },
            { label: "Coach 反馈", value: String(r["Coach反馈"] ?? "") },
          ]),
        })
      }

      if (starCases.length > 0) {
        sections.push({
          heading: "STAR 案例",
          items: starCases.map((s) => [
            { label: "标题", value: String(s["标题"] ?? "") },
            { label: "情境", value: String(s["情境"] ?? "") },
            { label: "任务", value: String(s["任务"] ?? "") },
            { label: "行动", value: String(s["行动"] ?? "") },
            { label: "结果", value: String(s["结果"] ?? "") },
            { label: "技能", value: String(s["技能"] ?? "") },
            { label: "影响力", value: String(s["影响力"] ?? "") },
            { label: "评分", value: String(s["评分"] ?? "") },
          ]),
        })
      }

      if (knowledgeItems.length > 0) {
        sections.push({
          heading: "知识库",
          items: knowledgeItems.map((k) => [
            { label: "标题", value: String(k["标题"] ?? "") },
            { label: "内容", value: String(k["内容"] ?? "") },
            { label: "分类", value: String(k["分类"] ?? "") },
            { label: "标签", value: String(k["标签"] ?? "") },
            { label: "掌握程度", value: String(k["掌握程度"] ?? "") },
          ]),
        })
      }

      if (reports.length > 0) {
        sections.push({
          heading: "报告",
          items: reports.map((r) => [
            { label: "标题", value: String(r["标题"] ?? "") },
            { label: "类型", value: String(r["类型"] ?? "") },
            { label: "状态", value: String(r["状态"] ?? "") },
            { label: "", value: mdToHtml(String(r["内容"] ?? "")) },
          ]),
        })
      }

      const html = buildHtmlReport({
        title: `AI 实习成长 - ${typeLabel[type]}导出`,
        exportedAt: now,
        exportedBy: userName,
        sections,
      })

      return new NextResponse(html, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Disposition": `attachment; filename="report_${type}_${Date.now()}.html"`,
        },
      })
    }

    return NextResponse.json({ error: "Unsupported format" }, { status: 400 })
  } catch (error) {
    return handleApiError(error, "POST /api/export")
  }
}
