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

// Canonical positions (aliases normalized into these).
const POSITIONS = ["抽卡师", "短剧运营", "短剧编剧", "内容策划运营", "剧本审核专员"] as const

function normPos(p: string | null): string {
  const s = (p ?? "").trim()
  if (!s) return "未分类"
  if (s.includes("抽卡")) return "抽卡师"
  if (s.includes("编剧")) return "短剧编剧"
  if (s.includes("内容策划") || s.includes("内容策略")) return "内容策划运营"
  if (s.includes("审核")) return "剧本审核专员"
  if (s.includes("运营")) return "短剧运营"
  return s
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
  const [posFilter, setPosFilter] = useState<string>("全部")

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

  const countByPos = (pos: string) => candidates.filter((c) => normPos(c.position) === pos).length

  // Positions to render as sections: a specific one when filtered, else all
  // canonical positions present plus any leftovers (e.g. 未分类).
  const present = Array.from(new Set(candidates.map((c) => normPos(c.position))))
  const orderedPresent = [
    ...POSITIONS.filter((p) => present.includes(p)),
    ...present.filter((p) => !POSITIONS.includes(p as (typeof POSITIONS)[number])),
  ]
  const sections = posFilter === "全部" ? orderedPresent : [posFilter]

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

      {/* Position filter */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {(["全部", ...POSITIONS] as string[]).map((p) => {
          const active = posFilter === p
          const n = p === "全部" ? candidates.length : countByPos(p)
          return (
            <button
              key={p}
              onClick={() => setPosFilter(p)}
              className={`text-xs rounded-full px-2.5 py-1 border transition-colors ${
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background hover:bg-muted border-border text-muted-foreground"
              }`}
            >
              {p}
              <span className={`ml-1 ${active ? "opacity-80" : "opacity-60"}`}>{n}</span>
            </button>
          )
        })}
      </div>

      {loading && candidates.length === 0 ? (
        <p className="text-xs text-muted-foreground py-6 text-center">加载中…</p>
      ) : candidates.length === 0 ? (
        <p className="text-xs text-muted-foreground py-6 text-center">
          还没有候选人。在飞书「候选人看板」表添加，或复盘时跟 AI 提到候选人即可自动建卡。
        </p>
      ) : (
        <div className="space-y-4">
          {sections.map((pos) => {
            const inPos = candidates.filter((c) => normPos(c.position) === pos)
            return (
              <section key={pos}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold">{pos}</span>
                  <span className="text-[10px] text-muted-foreground">{inPos.length} 人</span>
                </div>
                {inPos.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground pl-1">该岗位暂无候选人</p>
                ) : (
                  <div className="flex gap-3 overflow-x-auto pb-2">
                    {stages
                      .map((stage) => {
                        let items = inPos.filter((c) => c.currentStage === stage)
                        // 邀约面试：按面试日期排序，最近的在前，方便查看即将到来的面试
                        if (stage === "邀约面试") {
                          items = [...items].sort((a, b) =>
                            (a.interviewDate ?? "~").localeCompare(b.interviewDate ?? "~")
                          )
                        }
                        return { stage, items }
                      })
                      .filter(({ items }) => items.length > 0)
                      .map(({ stage, items }) => (
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
                                {stage === "邀约面试" &&
                                  (c.interviewDate ? (
                                    <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-0.5 leading-tight font-medium">
                                      🗓 面试 {c.interviewDate?.slice(5)}
                                    </p>
                                  ) : (
                                    <p className="text-[10px] text-red-500 mt-0.5 leading-tight">
                                      ⚠️ 未定面试日期
                                    </p>
                                  ))}
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
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
