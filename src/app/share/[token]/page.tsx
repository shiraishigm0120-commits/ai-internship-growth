"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { motion } from "framer-motion"
import { Sparkles, Award, TrendingUp, Calendar, Target } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"

interface SharedData {
  milestones: { title: string; description: string | null; icon: string; date: string; category: string }[]
  skills: { name: string; level: number }[]
  careerCapital: { category: string; count: number; unit: string }[]
  totalDays: number
  currentStreak: number
  totalMilestones: number
  userName: string
  companyName: string
  position: string
}

export default function SharedTimelinePage() {
  const { token } = useParams<{ token: string }>()
  const [data, setData] = useState<SharedData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/share/${token}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.error) setError(json.error)
        else setData(json.data)
      })
      .catch(() => setError("加载失败"))
      .finally(() => setLoading(false))
  }, [token])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="space-y-4 w-full max-w-2xl">
          <Skeleton className="h-8 w-48 mx-auto" />
          <Skeleton className="h-[400px] rounded-2xl" />
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center">
          <p className="text-muted-foreground">{error ?? "分享链接已失效"}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto space-y-8 py-8">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary mb-4">
            <Sparkles className="w-6 h-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">{data.userName} 的实习成长</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {data.companyName} · {data.position}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl border bg-card p-4 text-center">
            <div className="text-2xl font-bold text-primary">{data.totalDays}</div>
            <div className="text-xs text-muted-foreground mt-1">记录天数</div>
          </div>
          <div className="rounded-xl border bg-card p-4 text-center">
            <div className="text-2xl font-bold text-amber-500">{data.currentStreak}</div>
            <div className="text-xs text-muted-foreground mt-1">连续天数</div>
          </div>
          <div className="rounded-xl border bg-card p-4 text-center">
            <div className="text-2xl font-bold text-purple-500">{data.totalMilestones}</div>
            <div className="text-xs text-muted-foreground mt-1">里程碑</div>
          </div>
        </div>

        {/* Skills */}
        {data.skills.length > 0 && (
          <div className="rounded-2xl border bg-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-green-500" />
              <h2 className="font-semibold">能力概览</h2>
            </div>
            <div className="space-y-3">
              {data.skills.map((skill) => (
                <div key={skill.name} className="flex items-center gap-3">
                  <span className="w-20 text-sm text-muted-foreground">{skill.name}</span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(skill.level / 10) * 100}%` }}
                      transition={{ duration: 0.8 }}
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
                  <div className="text-xs text-muted-foreground">{cc.category}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Milestones */}
        {data.milestones.length > 0 && (
          <div className="rounded-2xl border bg-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Award className="w-5 h-5 text-yellow-500" />
              <h2 className="font-semibold">里程碑</h2>
            </div>
            <div className="space-y-4">
              {data.milestones.map((m, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-lg">{m.icon}</span>
                  <div>
                    <p className="text-sm font-medium">{m.title}</p>
                    {m.description && (
                      <p className="text-xs text-muted-foreground">{m.description}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground/60">
                      {new Date(m.date).toLocaleDateString("zh-CN")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground">
          由 AI Coach 生成 · AI 实习成长系统
        </p>
      </div>
    </div>
  )
}
