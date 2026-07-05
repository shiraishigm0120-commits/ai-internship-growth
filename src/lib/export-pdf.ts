export function generatePrintHtml(title: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: A4; margin: 2cm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
      font-size: 14px;
      line-height: 1.8;
      color: #1a1a1a;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
    }
    h1 { font-size: 24px; border-bottom: 2px solid #0071e3; padding-bottom: 8px; margin-bottom: 24px; }
    h2 { font-size: 18px; margin-top: 32px; margin-bottom: 12px; color: #0071e3; }
    h3 { font-size: 15px; margin-top: 20px; margin-bottom: 8px; }
    p { margin-bottom: 8px; }
    ul { margin: 8px 0 8px 20px; }
    li { margin-bottom: 4px; }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 12px;
      background: #f0f0f0;
      margin-right: 4px;
    }
    .section { margin-bottom: 24px; }
    .footer {
      margin-top: 40px;
      padding-top: 16px;
      border-top: 1px solid #e0e0e0;
      font-size: 12px;
      color: #999;
      text-align: center;
    }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="text-align:right;margin-bottom:20px;">
    <button onclick="window.print()" style="padding:8px 16px;background:#0071e3;color:white;border:none;border-radius:6px;cursor:pointer;font-size:14px;">
      保存为 PDF
    </button>
  </div>
  <h1>${escapeHtml(title)}</h1>
  <div>${markdownToHtml(content)}</div>
  <div class="footer">由 AI 实习成长系统生成</div>
  <script>setTimeout(() => window.print(), 500)</script>
</body>
</html>`
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function markdownToHtml(md: string): string {
  let html = md
    // Headers
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    // Bold
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    // Lists
    .replace(/^\- (.+)$/gm, "<li>$1</li>")
    .replace(/^(\d+)\. (.+)$/gm, "<li>$2</li>")
    // Paragraphs
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br>")

  // Wrap in paragraphs
  html = "<p>" + html + "</p>"
  // Fix empty paragraphs
  html = html.replace(/<p><\/p>/g, "")
  // Wrap consecutive li in ul
  html = html.replace(/(<li>.*?<\/li>(?:<br>)?)+/g, "<ul>$&</ul>")
  // Clean up br inside ul
  html = html.replace(/<ul>[\s\S]*?<\/ul>/g, (match) =>
    match.replace(/<br>/g, "")
  )

  return html
}

export function downloadMarkdown(title: string, content: string) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${title}.md`
  a.click()
  URL.revokeObjectURL(url)
}

export function openPdfPrint(title: string, content: string) {
  const html = generatePrintHtml(title, content)
  const blob = new Blob([html], { type: "text/html;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  window.open(url, "_blank")
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
