"use client"

import { useEffect, useState, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  TrendingUp,
  Award,
  Calendar,
  Target,
  AlertCircle,
  RefreshCw,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
} from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { ExportMenu } from "@/components/export/export-menu"
import { ShareButton } from "@/components/share/share-button"
import { toast } from "sonner"
import SkillTrendChart from "@/components/charts/skill-trend-chart"
import FunnelChart from "@/components/charts/funnel-chart"
import CandidateBoard from "@/components/charts/candidate-board"

interface TimelineData {
  milestones: {
    id: string
    title: string
    description: string | null
    icon: string
    date: string
    category: string
    recordId: string | null
  }[]
  skillTimeline: {
    date: string
    skills: { name: string; level: number }[]
  }[]
  currentSkills: {
    name: string
    level: number
    category: string
    trend: string
    evidenceCount: number
  }[]
  careerCapital: { category: string; count: number; unit: string }[]
  activityData: { date: string; wordCount: number }[]
  currentStreak: number
  totalDays: number
  totalMilestones: number
}

interface Goal {
  id: string
  userId: string
  title: string
  description: string | null
  category: string
  targetValue: number
  currentValue: number
  unit: string
  deadline: string | null
  status: string
  createdAt: string
  updatedAt: string
}

const GOAL_CATEGORIES: Record<string, string> = {
  skill: "技能提升",
  project: "项目完成",
  habit: "习惯养成",
  career: "职业发展",
}

const INCREMENTS = [1, 5, 10]

interface FunnelRow {
  label: string
  totalApplications: number
  passedScreening: number
  passedBusinessReview: number
  interviewInvited: number
  interviewAttendees: number
  offersSent: number
  offersAccepted: number
  onboarded: number
}

interface FunnelTotal {
  totalApplications: number
  passedScreening: number
  passedBusinessReview: number
  interviewInvited: number
  interviewAttendees: number
  offersSent: number
  offersAccepted: number
  onboarded: number
}

interface FunnelData {
  daily: FunnelRow[]
  weekly: FunnelRow[]
  monthly: FunnelRow[]
  total: FunnelTotal | null
  stages: { key: string; label: string; shortLabel: string }[]
  health: { from: string; to: string; label: string; low: number; high: number; lowLabel: string; highLabel: string }[]
}

export default function TimelinePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [data, setData] = useState<TimelineData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Goal state
  const [goals, setGoals] = useState<Goal[]>([])
  const [goalsLoading, setGoalsLoading] = useState(true)
  const [showGoalForm, setShowGoalForm] = useState(false)
  const [goalForm, setGoalForm] = useState({
    title: "",
    description: "",
    category: "skill",
    targetValue: 100,
    unit: "%",
    deadline: "",
  })
  const [submittingGoal, setSubmittingGoal] = useState(false)

  // Funnel state
  const [funnelData, setFunnelData] = useState<FunnelData | null>(null)
  const [funnelLoading, setFunnelLoading] = useState(true)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
      return
    }
    if (status === "authenticated") {
      fetchTimeline()
      fetchGoals()
      fetchFunnel()
    }
  }, [status])

  async function fetchTimeline() {
    setError(null)
    try {
      const res = await fetch("/api/stats/timeline")
      const json = await res.json()
      if (!res.ok || !json.data) {
        throw new Error(json.error ?? "获取成长数据失败")
      }
      setData(json.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取成长数据失败")
      console.error("Failed to fetch timeline:", err)
    } finally {
      setLoading(false)
    }
  }

  const fetchGoals = useCallback(async () => {
    try {
      const res = await fetch("/api/goals")
      if (res.ok) {
        const json = await res.json()
        setGoals(json.data ?? [])
      }
    } catch (err) {
      console.error("Failed to fetch goals:", err)
    } finally {
      setGoalsLoading(false)
    }
  }, [])

  const fetchFunnel = useCallback(async () => {
    try {
      const res = await fetch("/api/stats/funnel")
      if (res.ok) {
        const json = await res.json()
        setFunnelData(json.data)
      }
    } catch (err) {
      console.error("Failed to fetch funnel:", err)
    } finally {
      setFunnelLoading(false)
    }
  }, [])

  async function handleCreateGoal() {
    if (!goalForm.title.trim()) {
      toast.error("请输入目标标题")
      return
    }
    setSubmittingGoal(true)
    try {
      const res = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: goalForm.title.trim(),
          description: goalForm.description.trim() || undefined,
          category: goalForm.category,
          targetValue: goalForm.targetValue,
          unit: goalForm.unit,
          deadline: goalForm.deadline || undefined,
        }),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error ?? "创建失败")
      }
      const json = await res.json()
      setGoals((prev) => [json.data, ...prev])
      setShowGoalForm(false)
      setGoalForm({ title: "", description: "", category: "skill", targetValue: 100, unit: "%", deadline: "" })
      toast.success("目标创建成功")
    } catch (e: any) {
      toast.error(e.message ?? "创建失败，请重试")
    } finally {
      setSubmittingGoal(false)
    }
  }

  async function handleUpdateGoal(goalId: string, updates: Record<string, unknown>) {
    try {
      const res = await fetch(`/api/goals/${goalId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error ?? "更新失败")
      }
      const json = await res.json()
      setGoals((prev) => prev.map((g) => (g.id === goalId ? json.data : g)))
    } catch (e: any) {
      toast.error(e.message ?? "更新失败，请重试")
    }
  }

  async function handleIncrementGoal(goal: Goal, amount: number) {
    const newValue = Math.min(goal.currentValue + amount, goal.targetValue)
    await handleUpdateGoal(goal.id, { currentValue: newValue })
  }

  async function handleDeleteGoal(goalId: string) {
    try {
      const res = await fetch(`/api/goals/${goalId}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error ?? "删除失败")
      }
      setGoals((prev) => prev.filter((g) => g.id !== goalId))
      toast.success("目标已删除")
    } catch (e: any) {
      toast.error(e.message ?? "删除失败，请重试")
    }
  }

  // Get latest skill levels
  const latestSkills =
    data?.skillTimeline && data.skillTimeline.length > 0
      ? data.skillTimeline[data.skillTimeline.length - 1].skills
      : []

  if (status === "loading" || loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-[600px] rounded-2xl" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle className="w-10 h-10 text-red-400 mb-3" />
        <p className="text-sm text-red-500 mb-4">{error}</p>
        <Button variant="outline" size="sm" onClick={fetchTimeline}>
          <RefreshCw className="w-4 h-4 mr-2" />
          重试
        </Button>
      </div>
    )
  }

  if (!data) return null

  const isEmpty = data.totalDays === 0

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            成长时间轴
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            你的每一步成长，都留下了印记
          </p>
        </div>
        <div className="flex items-center gap-2">
            <ShareButton type="timeline" />
            <ExportMenu />
          </div>
        </div>

      {isEmpty ? (
        <div className="rounded-2xl border bg-card p-12 text-center">
          <Calendar className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">还没有记录</h2>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            开始每日记录后，你的成长轨迹、能力变化和职业资本将在这里展示。
          </p>
        </div>
      ) : (
        <>
          {/* Stats overview */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl border bg-card p-4 text-center">
              <div className="text-2xl font-bold text-primary">
                {data.totalDays}
              </div>
              <div className="text-xs text-muted-foreground mt-1">记录天数</div>
            </div>
            <div className="rounded-xl border bg-card p-4 text-center">
              <div className="text-2xl font-bold text-amber-500">
                {data.currentStreak}
              </div>
              <div className="text-xs text-muted-foreground mt-1">连续天数</div>
            </div>
            <div className="rounded-xl border bg-card p-4 text-center">
              <div className="text-2xl font-bold text-purple-500">
                {data.totalMilestones}
              </div>
              <div className="text-xs text-muted-foreground mt-1">里程碑</div>
            </div>
          </div>

          {/* Skill Trend Chart */}
          {data.skillTimeline && data.skillTimeline.length > 0 && (
            <div className="rounded-2xl border bg-card p-6">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-green-500" />
                <h2 className="font-semibold">能力变化趋势</h2>
              </div>
              <SkillTrendChart skillTimeline={data.skillTimeline} />
            </div>
          )}

          {/* Skill Progress (current snapshot) */}
          {latestSkills.length > 0 && (
            <div className="rounded-2xl border bg-card p-6">
              <div className="flex items-center gap-2 mb-4">
                <Award className="w-5 h-5 text-green-500" />
                <h2 className="font-semibold">当前能力</h2>
              </div>
              <div className="space-y-3">
                {latestSkills.map((skill) => (
                  <div key={skill.name} className="flex items-center gap-3">
                    <span className="w-20 text-sm text-muted-foreground flex-shrink-0">
                      {skill.name}
                    </span>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(skill.level / 10) * 100}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="h-full bg-gradient-to-r from-green-400 to-green-500 rounded-full"
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-8 text-right">
                      {skill.level}/10
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Goal Tracking */}
          <div className="rounded-2xl border bg-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-orange-500" />
                <h2 className="font-semibold">目标进度</h2>
              </div>
              <Button
                size="sm"
                onClick={() => setShowGoalForm(true)}
                disabled={showGoalForm}
              >
                <Plus className="w-4 h-4 mr-1" />
                新建目标
              </Button>
            </div>

            {/* Goal Create Form */}
            <AnimatePresence>
              {showGoalForm && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="bg-muted/30 border rounded-xl p-4 mb-4 space-y-3">
                    <h4 className="text-sm font-medium">新建目标</h4>

                    <div>
                      <label className="text-xs font-medium mb-1 block">目标标题 *</label>
                      <input
                        type="text"
                        value={goalForm.title}
                        onChange={(e) => setGoalForm((f) => ({ ...f, title: e.target.value }))}
                        placeholder="例如：完成 React 高级教程"
                        className="w-full bg-background border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium mb-1 block">描述（可选）</label>
                      <input
                        type="text"
                        value={goalForm.description}
                        onChange={(e) => setGoalForm((f) => ({ ...f, description: e.target.value }))}
                        placeholder="详细说明目标内容"
                        className="w-full bg-background border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium mb-1 block">类别</label>
                        <select
                          value={goalForm.category}
                          onChange={(e) => setGoalForm((f) => ({ ...f, category: e.target.value }))}
                          className="w-full bg-background border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                        >
                          {Object.entries(GOAL_CATEGORIES).map(([k, v]) => (
                            <option key={k} value={k}>
                              {v}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-medium mb-1 block">单位</label>
                        <input
                          type="text"
                          value={goalForm.unit}
                          onChange={(e) => setGoalForm((f) => ({ ...f, unit: e.target.value }))}
                          placeholder="%，次，天"
                          className="w-full bg-background border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-medium mb-1 block">目标值</label>
                        <input
                          type="number"
                          value={goalForm.targetValue}
                          onChange={(e) => setGoalForm((f) => ({ ...f, targetValue: Number(e.target.value) }))}
                          min={1}
                          className="w-full bg-background border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-medium mb-1 block">截止日期（可选）</label>
                        <input
                          type="date"
                          value={goalForm.deadline}
                          onChange={(e) => setGoalForm((f) => ({ ...f, deadline: e.target.value }))}
                          className="w-full bg-background border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowGoalForm(false)}
                      >
                        取消
                      </Button>
                      <Button size="sm" onClick={handleCreateGoal} disabled={submittingGoal}>
                        {submittingGoal ? "创建中…" : "创建目标"}
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Goal List */}
            {goalsLoading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />
                ))}
              </div>
            ) : goals.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                还没有目标，点击「新建目标」开始设定你的成长目标吧
              </p>
            ) : (
              <div className="space-y-3">
                {goals.map((goal) => {
                  const progress = goal.targetValue > 0
                    ? Math.round((goal.currentValue / goal.targetValue) * 100)
                    : 0
                  const isActive = goal.status === "active"

                  return (
                    <motion.div
                      key={goal.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`rounded-xl border p-4 ${
                        !isActive ? "opacity-60" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm truncate">
                              {goal.title}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground flex-shrink-0">
                              {GOAL_CATEGORIES[goal.category] ?? goal.category}
                            </span>
                            {goal.status === "completed" && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 flex-shrink-0">
                                已完成
                              </span>
                            )}
                            {goal.status === "abandoned" && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 flex-shrink-0">
                                已放弃
                              </span>
                            )}
                          </div>
                          {goal.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                              {goal.description}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-1 flex-shrink-0">
                          {isActive && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-green-500"
                                onClick={() => handleUpdateGoal(goal.id, { status: "completed" })}
                                title="标记完成"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-gray-400"
                                onClick={() => handleUpdateGoal(goal.id, { status: "abandoned" })}
                                title="放弃目标"
                              >
                                <XCircle className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-red-400 hover:text-red-500"
                            onClick={() => handleDeleteGoal(goal.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="flex items-center gap-3 mb-2">
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(progress, 100)}%` }}
                            transition={{ duration: 0.5, ease: "easeOut" }}
                            className={`h-full rounded-full ${
                              goal.status === "completed"
                                ? "bg-green-500"
                                : "bg-gradient-to-r from-orange-400 to-orange-500"
                            }`}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground w-16 text-right flex-shrink-0">
                          {goal.currentValue}/{goal.targetValue}{goal.unit}
                        </span>
                      </div>

                      {/* Controls */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {isActive && (
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-muted-foreground mr-1">进度:</span>
                            {INCREMENTS.map((inc) => (
                              <button
                                key={inc}
                                onClick={() => handleIncrementGoal(goal, inc)}
                                className="text-[10px] px-1.5 py-0.5 rounded border bg-background hover:bg-muted transition"
                              >
                                +{inc}
                              </button>
                            ))}
                          </div>
                        )}
                        {goal.deadline && (
                          <span className="text-[10px] text-muted-foreground ml-auto">
                            截止: {new Date(goal.deadline).toLocaleDateString("zh-CN")}
                          </span>
                        )}
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Activity Heatmap (simple version) */}
          {data.activityData.length > 0 && (
            <div className="rounded-2xl border bg-card p-6">
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="w-5 h-5 text-blue-500" />
                <h2 className="font-semibold">活跃度</h2>
              </div>
              <div className="flex flex-wrap gap-1">
                {data.activityData.slice(-90).map((day) => (
                  <div
                    key={day.date}
                    title={`${day.date}: ${day.wordCount} 字`}
                    className={`w-3 h-3 rounded-sm ${
                      day.wordCount > 200
                        ? "bg-green-500"
                        : day.wordCount > 100
                          ? "bg-green-400"
                          : day.wordCount > 50
                            ? "bg-green-300"
                            : day.wordCount > 0
                              ? "bg-green-200"
                              : "bg-muted"
                    }`}
                  />
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                最近 90 天每日字数热力图
              </p>
            </div>
          )}

          {/* Career Capital */}
          {data.careerCapital.length > 0 && (
            <div className="rounded-2xl border bg-card p-6">
              <div className="flex items-center gap-2 mb-4">
                <Target className="w-5 h-5 text-orange-500" />
                <h2 className="font-semibold">职业资本</h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {data.careerCapital.map((cc, i) => (
                  <div key={i} className="text-center">
                    <div className="text-xl font-bold">{cc.count}</div>
                    <div className="text-xs text-muted-foreground">
                      {cc.category}
                      {cc.unit ? `(${cc.unit})` : ""}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recruitment Funnel */}
          {!funnelLoading && (
            <div className="rounded-2xl border bg-card p-6">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-blue-500" />
                <h2 className="font-semibold">招聘漏斗</h2>
              </div>
              {funnelData ? (
                <FunnelChart data={funnelData} onRefresh={fetchFunnel} />
              ) : (
                <div className="h-48 bg-muted rounded-xl animate-pulse" />
              )}
              <div className="mt-4">
                <CandidateBoard />
              </div>
            </div>
          )}

          {/* Milestones Timeline */}
          {data.milestones.length > 0 && (
            <div className="rounded-2xl border bg-card p-6">
              <div className="flex items-center gap-2 mb-4">
                <Award className="w-5 h-5 text-yellow-500" />
                <h2 className="font-semibold">里程碑</h2>
                <span className="text-xs text-muted-foreground">
                  ({data.totalMilestones})
                </span>
              </div>
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-3 top-0 bottom-0 w-px bg-border" />

                <div className="space-y-6">
                  {data.milestones.map((m, i) => (
                    <motion.div
                      key={m.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="relative pl-8"
                    >
                      {/* Timeline dot */}
                      <div className="absolute left-1.5 top-1 w-4 h-4 rounded-full bg-card border-2 border-primary flex items-center justify-center">
                        <span className="text-[8px]">{m.icon}</span>
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{m.title}</span>
                          <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            {m.category === "first_time"
                              ? "第一次"
                              : m.category === "achievement"
                                ? "成就"
                                : m.category === "promotion"
                                  ? "提升"
                                  : "洞察"}
                          </span>
                        </div>
                        {m.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {m.description}
                          </p>
                        )}
                        <span className="text-[10px] text-muted-foreground/60 mt-1 block">
                          {new Date(m.date).toLocaleDateString("zh-CN")}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
