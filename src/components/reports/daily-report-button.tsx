"use client"

import { useState } from "react"
import { FileText, Copy, Check, X, RefreshCw } from "lucide-react"

function todayBeijing(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" })
}

export default function DailyReportButton() {
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(todayBeijing())
  const [text, setText] = useState("")
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  async function generate() {
    setLoading(true)
    setCopied(false)
    try {
      const res = await fetch(`/api/reports/daily-recruitment?date=${date}`)
      const json = await res.json()
      setText(res.ok ? (json.data?.text ?? "") : "生成失败，请稍后重试")
    } catch {
      setText("生成失败，请稍后重试")
    } finally {
      setLoading(false)
    }
  }

  async function handleOpen() {
    setOpen(true)
    if (!text) await generate()
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="flex items-center gap-1.5 text-xs rounded-lg border px-2.5 py-1.5 hover:bg-muted transition-colors"
      >
        <FileText className="w-3.5 h-3.5" />
        生成日报
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-card border rounded-2xl w-full max-w-lg p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <FileText className="w-4 h-4" />
                招聘日报
              </h3>
              <button
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground"
                aria-label="关闭"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2 mb-3">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="text-xs border rounded-lg px-2 py-1 bg-background"
              />
              <button
                onClick={generate}
                disabled={loading}
                className="flex items-center gap-1 text-xs rounded-lg border px-2.5 py-1 hover:bg-muted disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                生成
              </button>
              <button
                onClick={copy}
                className="flex items-center gap-1 text-xs rounded-lg border px-2.5 py-1 hover:bg-muted ml-auto"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "已复制" : "复制"}
              </button>
            </div>

            <textarea
              value={loading ? "生成中…" : text}
              readOnly
              rows={14}
              className="w-full text-xs border rounded-lg p-3 bg-muted/30 resize-none whitespace-pre-wrap"
            />
            <p className="text-[10px] text-muted-foreground mt-2">
              数量与名单来自候选人看板；「今日心得」取当天复盘。第 4–7 项为当前状态。
            </p>
          </div>
        </div>
      )}
    </>
  )
}
