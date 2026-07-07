"use client"

import { useEffect, useState, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { motion } from "framer-motion"
import {
  Sparkles,
  Play,
  TrendingUp,
  ArrowRight,
  Building2,
  Lightbulb,
  Target,
  Zap,
  AlertCircle,
  RefreshCw,
} from "lucide-react"
import { DailyRecordChat } from "@/components/daily-record/chat-interface"
import { useActiveInternship } from "@/hooks/use-active-internship"
import { hasDraft } from "@/hooks/use-chat-stream"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"

interface DiscoveryInsight {
  type: string
  title: string
  description: string
  icon: string
  priority: number
  relatedSkill?: string
}

interface TodayData {
  todayRecorded: boolean
  currentDay: number
  streakDays: number
  todayRecord?: {
    id: string
    title: string
    summary: string
    mood: string
    coachFeedback: string | null
    growthPoints: string | null
    workItems: { id: string; title: string; type: string }[]
    achievements: { id: string; title: string; icon: string | null }[]
  }
  growthMemory?: {
    summary: string
    skills: { name: string; level: number }[]
  } | null
  discovery?: {
    headline: string
    insights: DiscoveryInsight[]
    skillChanges: { name: string; from: number; to: number; direction: string }[]
    nextAction: string
  } | null
  yesterdayRecord?: { summary: string; date: string } | null
}

export default function TodayPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { internship, loading: internshipLoading, error: internshipError } = useActiveInternship()
  const [data, setData] = useState<TodayData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showChat, setShowChat] = useState(false)
  const fetchTodayData = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch("/api/stats/today")
      const json = await res.json()
      setData(json.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取今日数据失败")
      console.error("Failed to fetch today data:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
      return
    }
    if (status === "authenticated") {
      fetchTodayData()
    }
  }, [status, fetchTodayData])

  const handleChatSaved = useCallback(() => {
    setShowChat(false)
    fetchTodayData()
  }, [fetchTodayData])

  const timeGreeting = (() => {
    const hour = new Date().getHours()
    if (hour < 12) return "上午"
    if (hour < 14) return "中午"
    if (hour < 18) return "下午"
    return "晚上"
  })()

  if (status === "loading" || internshipLoading || loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-[400px] rounded-2xl" />
      </div>
    )
  }

  if (internshipError || error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle className="w-10 h-10 text-red-400 mb-3" />
        <p className="text-sm text-red-500 mb-4">{internshipError ?? error}</p>
        <Button variant="outline" size="sm" onClick={fetchTodayData}>
          <RefreshCw className="w-4 h-4 mr-2" />
          重试
        </Button>
      </div>
    )
  }

  if (!internship) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border bg-card p-12 text-center">
          <Building2 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">还未创建实习档案</h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
            在开始使用 AI 成长系统之前，需要先创建一个实习档案。
          </p>
          <Link href="/profile">
            <Button>去创建实习档案</Button>
          </Link>
        </div>
      </div>
    )
  }

  // Chat mode
  if (showChat) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              今日回顾
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {internship.companyName} · {internship.position} · 第 {data?.currentDay ?? 0} 天
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowChat(false)}>
            返回
          </Button>
        </div>
        <DailyRecordChat internshipId={internship?.id} onSaved={handleChatSaved} />
      </div>
    )
  }

  const discovery = data?.discovery
  const hasInsights = discovery && discovery.insights.length > 0

  // State A: Already recorded today → show Coach Feedback + Insights
  if (data?.todayRecorded && data.todayRecord) {
    const record = data.todayRecord
    return (
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {timeGreeting}好，{session?.user?.name ?? "同学"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            实习第 {data.currentDay} 天 · 连续记录 {data.streakDays} 天
          </p>
        </div>

        {/* HEADLINE: The ONE thing */}
        {discovery?.headline && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 p-6"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">AI 发现</p>
                <p className="text-lg font-semibold">{discovery.headline}</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Discovery Insights Grid */}
        {hasInsights && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {discovery.insights.slice(0, 4).map((insight, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className="rounded-xl border bg-card p-4 flex items-start gap-3"
              >
                <span className="text-2xl flex-shrink-0">{insight.icon}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{insight.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {insight.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Skill Changes */}
        {discovery?.skillChanges && discovery.skillChanges.length > 0 && (
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-green-500" />
              <span className="text-sm font-medium">能力变化</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {discovery.skillChanges.map((sc, i) => (
                <span
                  key={i}
                  className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full ${
                    sc.direction === "up"
                      ? "bg-green-100 dark:bg-green-900/20 text-green-700"
                      : sc.direction === "new"
                        ? "bg-blue-100 dark:bg-blue-900/20 text-blue-700"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {sc.direction === "up" ? "↑" : sc.direction === "new" ? "+" : "→"}
                  {sc.name} {sc.from > 0 ? `Lv.${sc.from}→${sc.to}` : `Lv.${sc.to}`}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Coach Feedback */}
        {record.coachFeedback && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="rounded-2xl border bg-card p-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-blue-600" />
              </div>
              <h2 className="font-semibold">Coach 反馈</h2>
            </div>
            <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground whitespace-pre-line text-sm">
              {record.coachFeedback}
            </div>
          </motion.div>
        )}

        {/* Tomorrow's suggestion */}
        {discovery?.nextAction && (
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center">
                <Target className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">明天的小目标</p>
                <p className="text-sm font-medium">{discovery.nextAction}</p>
              </div>
            </div>
          </div>
        )}

        {/* Record another? */}
        <div className="flex gap-3 pt-2">
          <Button variant="outline" onClick={() => setShowChat(true)}>
            <Play className="w-4 h-4 mr-2" />
            再次回顾
          </Button>
          <Link href="/timeline">
            <Button variant="ghost">
              成长时间轴
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  // State B: No record today → Insights from past + nudge to record
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {timeGreeting}好，{session?.user?.name ?? "同学"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {internship.companyName} · {internship.position} · 第 {data?.currentDay ?? 0} 天
        </p>
      </div>

      {/* If we have growth insights from past data, show them FIRST */}
      {hasInsights ? (
        <>
          {/* HEADLINE */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 p-6"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <Lightbulb className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">最近动态</p>
                <p className="text-lg font-semibold">{discovery.headline}</p>
              </div>
            </div>
          </motion.div>

          {/* Insights */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {discovery.insights.slice(0, 4).map((insight, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className="rounded-xl border bg-card p-4 flex items-start gap-3"
              >
                <span className="text-2xl flex-shrink-0">{insight.icon}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{insight.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {insight.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Nudge to record */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-xl border-2 border-dashed border-primary/30 bg-card p-6 text-center"
          >
            <Zap className="w-8 h-8 text-primary/60 mx-auto mb-3" />
            <p className="text-sm font-medium mb-1">今天有什么新收获吗？</p>
            <p className="text-xs text-muted-foreground mb-4">
              {data.streakDays > 0
                ? `你已经连续记录了 ${data.streakDays} 天，别断了`
                : "花 3 分钟，让 AI 帮你发现今天的成长"}
            </p>
            {hasDraft(internship?.id) ? (
              <div className="flex flex-col items-center gap-2">
                <Button onClick={() => setShowChat(true)}>
                  <Play className="w-4 h-4 mr-2" />
                  继续未完成的记录
                </Button>
                <span className="text-xs text-muted-foreground">
                  检测到未完成的对话，点击继续
                </span>
              </div>
            ) : (
              <Button onClick={() => setShowChat(true)}>
                <Play className="w-4 h-4 mr-2" />
                开始今日回顾
              </Button>
            )}
          </motion.div>

          {discovery?.nextAction && (
            <div className="rounded-xl border bg-card p-4">
              <div className="flex items-center gap-3">
                <Target className="w-4 h-4 text-amber-500" />
                <div>
                  <p className="text-xs text-muted-foreground">今天可以试试</p>
                  <p className="text-sm font-medium">{discovery.nextAction}</p>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        // No insights yet: first-time user or no data
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border bg-card p-8 text-center"
        >
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-xl font-semibold mb-2">
            {data && data.streakDays > 0
              ? `已连续记录 ${data.streakDays} 天`
              : "开始你的成长之旅"}
          </h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
            {data && data.streakDays > 0
              ? "继续保持！每次记录都是成长的证据。"
              : "AI Coach 会像导师一样，帮你发现每一天的成长。像聊天一样自然，3 分钟就够了。"}
          </p>
          {hasDraft(internship?.id) ? (
            <div className="flex flex-col items-center gap-2">
              <Button size="lg" onClick={() => setShowChat(true)}>
                <Play className="w-5 h-5 mr-2" />
                继续未完成的记录
              </Button>
              <span className="text-xs text-muted-foreground">
                检测到未完成的对话
              </span>
            </div>
          ) : (
            <Button size="lg" onClick={() => setShowChat(true)}>
              <Play className="w-5 h-5 mr-2" />
              开始今日回顾
            </Button>
          )}
        </motion.div>
      )}

      {/* Yesterday reference for continuity */}
      {data?.yesterdayRecord && !hasInsights && (
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">上次记录</p>
          <p className="text-sm line-clamp-2">{data.yesterdayRecord.summary}</p>
        </div>
      )}
    </div>
  )
}
