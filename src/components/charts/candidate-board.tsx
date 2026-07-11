"use client"

import { useEffect, useState } from "react"
import { RefreshCw, Users } from "lucide-react"

interface Candidate {
  id: string
  name: string
  position: string | null
  currentStage: string
  statusNote: string | null
  recommendedDate: string | null
  businessPassDate: string | null
  interviewInviteDate: string | null
  interviewDate: string | null
  offerDate: string | null
  offerAcceptDate: string | null
  onboardDate: string | null
}

// Stage → accent color for the column header dot.
const STAGE_COLOR: Record<string, string> = {
  推荐简历: "#6366f1",
  业务筛选: "#0ea5e9",
  邀约面试: "#ec4899",
  已面试: "#f59e0b",
  面试通过: "#10b981",
  Offer: "#8b5cf6",
  待入职: "#14b8a6",
  已入职: "#22c55e",
  已淘汰: "#94a3b8",
}

// Latest stage date to show on each card, by stage.
function latestDate(c: Candidate): string | null {
  return (
    c.onboardDate ?? c.offerAcceptDate ?? c.offerDate ?? c.interviewDate ??
    c.interviewInviteDate ?? c.businessPassDate ?? c.recommendedDate
  )
}

export default function CandidateBoard() {
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [stages, setStages] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch("/api/candidates")
      if (res.ok) {
        const json = await res.json()
        setCandidates(json.data.candidates ?? [])
        setStages(json.data.stages ?? [])
      }
    } catch (e) {
      console.error("Failed to load candidates:", e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const grouped = stages.map((s) => ({
    stage: s,
    items: candidates.filter((c) => c.currentStage === s),
  }))

  return (
    <div className="bg-muted/30 border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">候选人看板</h3>
          <span className="text-xs text-muted-foreground">共 {candidates.length} 人 · 候选人追踪</span>
        </div>
        <button
          onClick={load}
          className="text-muted-foreground hover:text-foreground transition-colors"
          title="从飞书刷新"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {loading && candidates.length === 0 ? (
        <p className="text-xs text-muted-foreground py-6 text-center">加载中…</p>
      ) : candidates.length === 0 ? (
        <p className="text-xs text-muted-foreground py-6 text-center">
          还没有候选人。在飞书「候选人看板」表添加，或复盘时跟 AI 提到候选人即可自动建卡。
        </p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {grouped.map(({ stage, items }) => (
            <div key={stage} className="min-w-[150px] flex-shrink-0">
              <div className="flex items-center gap-1.5 mb-2 px-1">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: STAGE_COLOR[stage] ?? "#94a3b8" }}
                />
                <span className="text-xs font-medium">{stage}</span>
                <span className="text-[10px] text-muted-foreground">{items.length}</span>
              </div>
              <div className="space-y-1.5">
                {items.map((c) => (
                  <div key={c.id} className="rounded-lg border bg-card p-2 text-xs">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-medium truncate">{c.name}</span>
                      {latestDate(c) && (
                        <span className="text-[10px] text-muted-foreground flex-shrink-0">
                          {latestDate(c)?.slice(5)}
                        </span>
                      )}
                    </div>
                    {c.position && (
                      <span className="text-[10px] text-muted-foreground">{c.position}</span>
                    )}
                    {c.statusNote && (
                      <p className="text-[10px] text-amber-600 dark:text-amber-500 mt-0.5 leading-tight">
                        {c.statusNote}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
