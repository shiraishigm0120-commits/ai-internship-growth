"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { FileText, Download, Eye, EyeOff, Plus, Loader2, Trash2, Calendar, AlertCircle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ExportMenu } from "@/components/export/export-menu"
import { ShareButton } from "@/components/share/share-button"
import { toast } from "sonner"

interface Report {
  id: string
  title: string
  type: string
  format: string
  content: string | null
  createdAt: string
}

const REPORT_TYPES = [
  { value: "INTERNSHIP_SUMMARY", label: "实习总结" },
  { value: "WEEKLY", label: "周报" },
  { value: "MONTHLY", label: "月报" },
  { value: "FINAL", label: "实习总结报告" },
]

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [formTitle, setFormTitle] = useState("")
  const [formType, setFormType] = useState("INTERNSHIP_SUMMARY")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [sections, setSections] = useState({
    workItems: true,
    knowledge: true,
    achievements: true,
  })

  const fetchReports = useCallback(async () => {
    try {
      const res = await fetch("/api/reports")
      if (res.ok) {
        const json = await res.json()
        setReports(json.data ?? [])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取报告数据失败")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchReports()
  }, [fetchReports])

  async function handleGenerate() {
    if (!formTitle.trim()) {
      toast.error("请输入报告标题")
      return
    }
    setGenerating(true)
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formTitle.trim(),
          type: formType,
          format: "MARKDOWN",
          dateRange: dateFrom || dateTo
            ? { from: dateFrom || undefined, to: dateTo || undefined }
            : undefined,
          sections: Object.entries(sections)
            .filter(([, v]) => v)
            .map(([k]) => k),
        }),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error ?? "生成失败")
      }
      const json = await res.json()
      setReports((prev) => [json.data, ...prev])
      setShowForm(false)
      setFormTitle("")
      setDateFrom("")
      setDateTo("")
      setShowAdvanced(false)
      setSections({ workItems: true, knowledge: true, achievements: true })
      toast.success("报告生成成功！")
      setExpandedId(json.data.id)
    } catch (e: any) {
      toast.error(e.message ?? "生成失败，请重试")
    } finally {
      setGenerating(false)
    }
  }

  function downloadMarkdown(report: Report) {
    if (!report.content) return
    const blob = new Blob([report.content], { type: "text/markdown;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${report.title.replace(/[^a-zA-Z0-9一-龥]/g, "_")}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  async function handleDelete(reportId: string) {
    try {
      const res = await fetch(`/api/reports/${reportId}`, { method: "DELETE" })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error ?? "删除失败")
      }
      setReports((prev) => prev.filter((r) => r.id !== reportId))
      if (expandedId === reportId) setExpandedId(null)
      toast.success("报告已删除")
    } catch (e: any) {
      toast.error(e.message ?? "删除失败，请重试")
    }
  }

  return (
    <main className="max-w-4xl mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">实习报告</h1>
          <p className="text-sm text-muted-foreground mt-1">
            根据你的实习记录，一键生成 Markdown 格式的实习报告
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ShareButton type="timeline" />
          <ExportMenu />
          <Button
            onClick={() => setShowForm(true)}
            disabled={showForm}
          >
            <Plus className="w-4 h-4 mr-2" />
            生成报告
          </Button>
        </div>
      </div>

      {/* Generate Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-card border rounded-xl p-5 space-y-4">
              <h3 className="font-medium">新建报告</h3>

              <div>
                <label className="text-sm font-medium mb-1.5 block">报告标题</label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="例如：2026年7月实习周报"
                  className="w-full bg-background border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">报告类型</label>
                <div className="flex gap-2 flex-wrap">
                  {REPORT_TYPES.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => setFormType(t.value)}
                      className={`px-3 py-1.5 rounded-lg text-sm transition ${
                        formType === t.value
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted hover:bg-muted/80"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Advanced options toggle */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="text-sm text-muted-foreground hover:text-foreground transition flex items-center gap-1"
                >
                  <span>{showAdvanced ? "收起高级选项 ▲" : "展开高级选项 ▼"}</span>
                </button>
              </div>

              <AnimatePresence>
                {showAdvanced && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-4 pt-2">
                      {/* Date Range */}
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">
                          日期范围（可选，不选则包含所有记录）
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                            className="flex-1 bg-background border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                          />
                          <span className="text-xs text-muted-foreground">至</span>
                          <input
                            type="date"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                            className="flex-1 bg-background border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                          />
                        </div>
                      </div>

                      {/* Section toggles */}
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">
                          报告包含内容
                        </label>
                        <div className="flex gap-3 flex-wrap">
                          {[
                            { key: "workItems", label: "工作成果" },
                            { key: "knowledge", label: "学习知识" },
                            { key: "achievements", label: "成就" },
                          ].map(({ key, label }) => (
                            <label
                              key={key}
                              className="flex items-center gap-1.5 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={sections[key as keyof typeof sections]}
                                onChange={(e) =>
                                  setSections((prev) => ({
                                    ...prev,
                                    [key]: e.target.checked,
                                  }))
                                }
                                className="w-4 h-4 rounded accent-primary"
                              />
                              <span className="text-sm">{label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowForm(false)
                    setDateFrom("")
                    setDateTo("")
                    setShowAdvanced(false)
                    setSections({ workItems: true, knowledge: true, achievements: true })
                  }}
                >
                  取消
                </Button>
                <Button onClick={handleGenerate} disabled={generating}>
                  {generating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {generating ? "生成中…" : "开始生成"}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Report List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-card border rounded-xl p-5 animate-pulse">
              <div className="h-5 bg-muted rounded w-1/3 mb-3" />
              <div className="h-3 bg-muted rounded w-1/4" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <AlertCircle className="w-10 h-10 text-red-400 mb-3" />
          <p className="text-sm text-red-500 mb-4">{error}</p>
          <Button variant="outline" size="sm" onClick={() => { setError(null); fetchReports() }}>
            <RefreshCw className="w-4 h-4 mr-2" />
            重试
          </Button>
        </div>
      ) : reports.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-medium">还没有报告</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            点击「生成报告」按钮，AI 会根据你的实习记录自动生成一份结构化的 Markdown 报告。
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <motion.div
              key={report.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card border rounded-xl overflow-hidden"
            >
              {/* Report Row */}
              <button
                onClick={() =>
                  setExpandedId(expandedId === report.id ? null : report.id)
                }
                className="w-full px-5 py-4 flex items-center justify-between hover:bg-muted/30 transition text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="w-5 h-5 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium truncate">{report.title}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                      <span>{REPORT_TYPES.find((t) => t.value === report.type)?.label ?? report.type}</span>
                      <span>·</span>
                      <Calendar className="w-3 h-3" />
                      <span>{new Date(report.createdAt).toLocaleDateString("zh-CN")}</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-2">
                  {report.content && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        downloadMarkdown(report)
                      }}
                      className="h-8 w-8 p-0"
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(report.id)
                    }}
                    className="h-8 w-8 p-0 text-red-400 hover:text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                  {expandedId === report.id ? (
                    <EyeOff className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <Eye className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              </button>

              {/* Preview */}
              <AnimatePresence>
                {expandedId === report.id && report.content && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="border-t px-5 py-4 max-h-[500px] overflow-y-auto">
                      <pre className="text-sm font-mono text-muted-foreground whitespace-pre-wrap leading-relaxed">
                        {report.content}
                      </pre>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      )}
    </main>
  )
}
