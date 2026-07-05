"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { TrendingUp, Award, Calendar, Target } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"

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
  careerCapital: { category: string; count: number; unit: string }[]
  activityData: { date: string; wordCount: number }[]
  currentStreak: number
  totalDays: number
  totalMilestones: number
}

export default function TimelinePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [data, setData] = useState<TimelineData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
      return
    }
    if (status === "authenticated") {
      fetchTimeline()
    }
  }, [status])

  async function fetchTimeline() {
    try {
      const res = await fetch("/api/stats/timeline")
      const json = await res.json()
      setData(json.data)
    } catch (error) {
      console.error("Failed to fetch timeline:", error)
    } finally {
      setLoading(false)
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

  if (!data) return null

  const isEmpty = data.totalDays === 0

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          成长时间轴
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          你的每一步成长，都留下了印记
        </p>
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

          {/* Skill Progress */}
          {latestSkills.length > 0 && (
            <div className="rounded-2xl border bg-card p-6">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-green-500" />
                <h2 className="font-semibold">能力变化</h2>
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
