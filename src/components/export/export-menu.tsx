"use client"

import { useState } from "react"
import {
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  Loader2,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"

type ExportType = "records" | "starCases" | "knowledge" | "reports" | "all"
type ExportFormat = "json" | "csv" | "pdf"

interface ExportOption {
  type: ExportType
  label: string
  formats: ExportFormat[]
}

const EXPORT_OPTIONS: ExportOption[] = [
  { type: "records", label: "每日记录", formats: ["json", "csv", "pdf"] },
  { type: "starCases", label: "STAR 案例", formats: ["json", "csv", "pdf"] },
  { type: "knowledge", label: "知识库", formats: ["json", "csv"] },
  { type: "reports", label: "报告", formats: ["json", "csv"] },
]

const FORMAT_ICONS: Record<ExportFormat, typeof FileJson> = {
  json: FileJson,
  csv: FileSpreadsheet,
  pdf: FileText,
}

const FORMAT_LABELS: Record<ExportFormat, string> = {
  json: "JSON",
  csv: "CSV",
  pdf: "网页报告",
}

async function downloadExport(type: ExportType, format: ExportFormat) {
  const res = await fetch("/api/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, format }),
  })

  if (!res.ok) {
    const json = await res.json().catch(() => ({ error: "导出失败" }))
    throw new Error(json.error ?? "导出失败")
  }

  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  const ext = format === "pdf" ? "html" : format === "csv" ? "csv" : "json"
  a.download = `export_${type}_${Date.now()}.${ext}`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function ExportMenu() {
  const [loading, setLoading] = useState<string | null>(null)

  async function handleExport(type: ExportType, format: ExportFormat) {
    const key = `${type}-${format}`
    setLoading(key)
    try {
      await downloadExport(type, format)
      toast.success(`导出成功 (${FORMAT_LABELS[format]})`)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "导出失败")
    } finally {
      setLoading(null)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="group/button inline-flex shrink-0 items-center justify-center gap-2 border border-input bg-background text-sm font-medium rounded-lg px-3 h-8 hover:bg-accent hover:text-accent-foreground transition"
      >
        <Download className="w-4 h-4" />
        导出数据
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuGroup>
          <DropdownMenuLabel>导出数据</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />

        {EXPORT_OPTIONS.map((option) => (
          <DropdownMenuSub key={option.type}>
            <DropdownMenuSubTrigger>
              {option.label}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {option.formats.map((fmt) => {
                const Icon = FORMAT_ICONS[fmt]
                const key = `${option.type}-${fmt}`
                const isLoading = loading === key
                return (
                  <DropdownMenuItem
                    key={fmt}
                    onClick={() => handleExport(option.type, fmt)}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Icon className="w-4 h-4 mr-2" />
                    )}
                    {FORMAT_LABELS[fmt]}
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        ))}

        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => handleExport("all", "json")}>
          {loading === "all-json" ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <FileJson className="w-4 h-4 mr-2" />
          )}
          导出全部 (JSON)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
