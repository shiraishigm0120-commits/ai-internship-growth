"use client"

import { useState } from "react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts"
import { Edit3, TrendingDown, Plus, Check, AlertTriangle, ThumbsUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

// ── Types ──
interface FunnelRow {
  label: string
  totalApplications: number
  passedScreening: number
  passedBusinessReview: number
  interviewAttendees: number
  offersSent: number
  offersAccepted: number
  onboarded: number
}

interface FunnelTotal {
  totalApplications: number
  passedScreening: number
  passedBusinessReview: number
  interviewAttendees: number
  offersSent: number
  offersAccepted: number
  onboarded: number
}

interface StageDef {
  key: string
  label: string
  shortLabel: string
}

interface HealthDef {
  from: string
  to: string
  label: string
  low: number
  high: number
  lowLabel: string
  highLabel: string
}

interface FunnelData {
  daily: FunnelRow[]
  weekly: FunnelRow[]
  monthly: FunnelRow[]
  total: FunnelTotal | null
  stages: StageDef[]
  health: HealthDef[]
}

type ViewMode = "daily" | "weekly" | "monthly" | "total"

const COLORS = [
  "#3b82f6", // blue - 投递
  "#6366f1", // indigo - 初筛
  "#8b5cf6", // violet - 业务筛选
  "#f59e0b", // amber - 面试
  "#ef4444", // red - Offer
  "#06b6d4", // cyan - 接受
  "#22c55e", // green - 入职
]

// ── Helpers ──
function pct(a: number, b: number): number {
  if (b === 0) return 0
  return Math.round((a / b) * 100)
}

function healthStatus(rate: number, low: number, high: number): "good" | "warn" | "bad" {
  if (rate >= low && rate <= high) return "good"
  if (rate < low) return "bad"
  return "warn"
}

function healthColor(status: "good" | "warn" | "bad"): string {
  if (status === "good") return "#22c55e"
  if (status === "warn") return "#f59e0b"
  return "#ef4444"
}

// ── SVG Funnel ──
function FunnelSVG({ total, health }: { total: FunnelTotal; health: HealthDef[] }) {
  const keys = ["totalApplications", "passedScreening", "passedBusinessReview", "interviewAttendees", "offersSent", "offersAccepted", "onboarded"]
  const labels = ["投递量", "初筛通过", "业务筛选通过", "面试到场", "Offer发出", "Offer接受", "入职"]
  const values = keys.map((k) => total[k as keyof FunnelTotal] || 0)
  const maxVal = Math.max(...values, 1)
  const stages = labels.map((label, i) => ({
    label,
    value: values[i],
    pct: Math.ceil((values[i] / maxVal) * 100),
    color: COLORS[i],
  }))

  const conversions = health.map((h) => {
    const fromVal = total[h.from as keyof FunnelTotal] || 0
    const toVal = total[h.to as keyof FunnelTotal] || 0
    const rate = pct(toVal, fromVal)
    const status = healthStatus(rate, h.low, h.high)
    return { ...h, rate, status }
  })

  return (
    <div className="flex flex-col items-center py-2">
      <svg width="360" height={stages.length * 62 + 20} viewBox={`0 0 360 ${stages.length * 62 + 20}`}>
        {stages.map((stage, i) => {
          const y = i * 62 + 10
          const maxW = 300
          const width = Math.max((stage.pct / 100) * maxW, 30)
          const x = (360 - width) / 2

          return (
            <g key={i}>
              <rect x={x} y={y} width={width} height={36} rx={6} fill={stage.color} opacity={0.88} />
              <text x={x + width / 2} y={y + 22} textAnchor="middle" fill="#fff" fontSize={13} fontWeight={700}>
                {stage.label}
              </text>
              <text x={x - 8} y={y + 22} textAnchor="end" fill="currentColor" fontSize={20} fontWeight={800} className="fill-foreground">
                {stage.value.toLocaleString()}
              </text>

              {/* Conversion arrow */}
              {i < stages.length - 1 && conversions[i] && (
                <g>
                  <line x1={180} y1={y + 36} x2={180} y2={y + 50} stroke="currentColor" strokeWidth={1} opacity={0.15} strokeDasharray="4 3" />
                  <polygon points="174,44 180,52 186,44" fill={healthColor(conversions[i].status)} opacity={0.6} />
                  <text x={x + width + 10} y={y + 48} textAnchor="start" fontSize={10} fill={healthColor(conversions[i].status)} fontWeight={500}>
                    {conversions[i].label} {conversions[i].rate}%
                  </text>
                </g>
              )}
            </g>
          )
        })}
      </svg>

      {/* Health indicators */}
      <div className="w-full grid grid-cols-2 gap-2 mt-2">
        {conversions.map((c, i) => (
          <div key={i} className="flex items-start gap-1.5 text-[10px] rounded-lg border px-2 py-1.5" style={{ borderColor: healthColor(c.status) + "40" }}>
            {c.status === "good" ? (
              <ThumbsUp className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color: healthColor(c.status) }} />
            ) : c.status === "warn" ? (
              <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color: healthColor(c.status) }} />
            ) : (
              <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color: healthColor(c.status) }} />
            )}
            <div>
              <span className="font-medium">{c.label}</span>
              <span className="font-bold ml-1" style={{ color: healthColor(c.status) }}>{c.rate}%</span>
              <span className="text-muted-foreground ml-1">({c.low}-{c.high}%)</span>
              {c.status !== "good" && (
                <div className="text-muted-foreground mt-0.5">
                  {c.status === "bad" ? c.lowLabel : c.highLabel}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Bar Chart ──
function TimeSeriesChart({ data, stages }: { data: FunnelRow[]; stages: StageDef[] }) {
  const formatted = data.map((row) => ({
    label: row.label,
    投递量: row.totalApplications,
    初筛通过: row.passedScreening,
    业务筛选通过: row.passedBusinessReview,
    面试到场: row.interviewAttendees,
    Offer发出: row.offersSent,
    Offer接受: row.offersAccepted,
    入职: row.onboarded,
  }))

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={formatted} margin={{ top: 5, right: 8, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="label" tick={{ fontSize: 10 }} className="text-muted-foreground" interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 10 }} className="text-muted-foreground" width={36} allowDecimals={false} />
        <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", fontSize: "11px" }} />
        <Legend wrapperStyle={{ fontSize: "10px" }} />
        <Bar dataKey="投递量" fill={COLORS[0]} radius={[2, 2, 0, 0]} />
        <Bar dataKey="初筛通过" fill={COLORS[1]} radius={[2, 2, 0, 0]} />
        <Bar dataKey="业务筛选通过" fill={COLORS[2]} radius={[2, 2, 0, 0]} />
        <Bar dataKey="面试到场" fill={COLORS[3]} radius={[2, 2, 0, 0]} />
        <Bar dataKey="Offer发出" fill={COLORS[4]} radius={[2, 2, 0, 0]} />
        <Bar dataKey="Offer接受" fill={COLORS[5]} radius={[2, 2, 0, 0]} />
        <Bar dataKey="入职" fill={COLORS[6]} radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Inline Form ──
function FunnelForm({ defaultValues, onSaved, stages }: { defaultValues?: FunnelRow; onSaved: () => void; stages: StageDef[] }) {
  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({
    date: defaultValues?.label ?? today,
    totalApplications: defaultValues?.totalApplications ?? 0,
    passedScreening: defaultValues?.passedScreening ?? 0,
    passedBusinessReview: defaultValues?.passedBusinessReview ?? 0,
    interviewAttendees: defaultValues?.interviewAttendees ?? 0,
    offersSent: defaultValues?.offersSent ?? 0,
    offersAccepted: defaultValues?.offersAccepted ?? 0,
    onboarded: defaultValues?.onboarded ?? 0,
  })
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch("/api/stats/funnel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error ?? "保存失败")
      }
      toast.success("漏斗数据已保存")
      onSaved()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "保存失败")
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input
        type="date"
        value={form.date}
        onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
        className="bg-background border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
        {stages.map((s, i) => (
          <div key={s.key}>
            <label className="text-[10px] text-muted-foreground block mb-0.5 truncate" title={s.label}>
              {s.shortLabel}
            </label>
            <input
              type="number"
              min={0}
              value={String(form[s.key as keyof typeof form] ?? 0)}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10)
                setForm((prev) => ({ ...prev, [s.key]: isNaN(val) ? 0 : val }))
              }}
              className="w-full bg-background border rounded-lg px-1.5 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/20"
              style={{ borderColor: COLORS[i] + "40" }}
            />
          </div>
        ))}
      </div>
      <Button type="submit" size="sm" disabled={saving} className="w-full">
        {saving ? "保存中…" : defaultValues ? "更新今日数据" : "保存今日数据"}
        {!saving && (defaultValues ? <Check className="w-3.5 h-3.5 ml-1" /> : <Plus className="w-3.5 h-3.5 ml-1" />)}
      </Button>
    </form>
  )
}

// ── Export ──
export default function FunnelChart({ data, onRefresh }: { data: FunnelData; onRefresh: () => void }) {
  const [viewMode, setViewMode] = useState<ViewMode>("total")
  const [showForm, setShowForm] = useState(false)

  const modes: { key: ViewMode; label: string }[] = [
    { key: "daily", label: "每日" },
    { key: "weekly", label: "每周" },
    { key: "monthly", label: "每月" },
    { key: "total", label: "漏斗总览" },
  ]

  const hasAnyData = data.total && Object.values(data.total).some((v) => v > 0)

  return (
    <div className="space-y-4">
      {/* Header controls */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
          {modes.map((m) => (
            <button
              key={m.key}
              onClick={() => setViewMode(m.key)}
              className={`px-2.5 py-1 text-xs rounded-md transition whitespace-nowrap ${
                viewMode === m.key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <Button variant="ghost" size="sm" onClick={() => setShowForm(!showForm)}>
          <Edit3 className="w-3.5 h-3.5 mr-1" />
          {showForm ? "收起" : "录入数据"}
        </Button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-muted/30 border rounded-xl p-4">
          <FunnelForm
            defaultValues={data.daily.find((d) => d.label === new Date().toISOString().slice(0, 10))}
            onSaved={() => { onRefresh(); setShowForm(false) }}
            stages={data.stages}
          />
        </div>
      )}

      {/* Visualization */}
      {!hasAnyData ? (
        <div className="flex flex-col items-center justify-center h-48 text-sm text-muted-foreground">
          <TrendingDown className="w-8 h-8 mb-2 opacity-30" />
          暂无招聘漏斗数据，点击「录入数据」开始记录每日招聘数据
        </div>
      ) : viewMode === "total" && data.total ? (
        <FunnelSVG total={data.total} health={data.health} />
      ) : viewMode === "daily" && data.daily.length > 0 ? (
        <TimeSeriesChart data={data.daily} stages={data.stages} />
      ) : viewMode === "weekly" && data.weekly.length > 0 ? (
        <TimeSeriesChart data={data.weekly} stages={data.stages} />
      ) : viewMode === "monthly" && data.monthly.length > 0 ? (
        <TimeSeriesChart data={data.monthly} stages={data.stages} />
      ) : (
        <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
          当前视图暂无数据
        </div>
      )}

      {/* Summary cards */}
      {data.total && hasAnyData && (
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5 text-center">
          {data.stages.map((s, i) => {
            const val = data.total![s.key as keyof FunnelTotal] || 0
            return (
              <div key={s.key} className="rounded-lg border bg-card p-2">
                <div className="text-sm font-bold" style={{ color: COLORS[i] }}>
                  {val.toLocaleString()}
                </div>
                <div className="text-[10px] text-muted-foreground leading-tight">{s.shortLabel}</div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
