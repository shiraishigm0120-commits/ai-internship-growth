"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { ArrowLeft, CalendarDays, Clock, Smile } from "lucide-react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"

type RecordDetail = {
  id: string
  date: string
  title?: string
  summary?: string
  mood?: string
  hoursWorked?: number
  conversation: string
  workItems: {
    id: string
    type: string
    title: string
    description?: string
    tags: string
    status: string
  }[]
  knowledgeItems: {
    id: string
    category: string
    title: string
    content: string
    tags: string
    masteryLevel: string
  }[]
  achievements: {
    id: string
    title: string
    description?: string
    category: string
    icon?: string
    value?: number
    unit?: string
  }[]
}

export default function DailyRecordDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: session, status } = useSession()
  const router = useRouter()
  const [record, setRecord] = useState<RecordDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
    if (status === "authenticated") fetchRecord()
  }, [status, id])

  async function fetchRecord() {
    try {
      const res = await fetch(`/api/daily-records/${id}`)
      const json = await res.json()
      setRecord(json.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取记录失败")
      console.error("Failed to fetch record:", err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 max-w-2xl">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-red-500 text-sm mb-2">{error}</p>
        <button
          onClick={() => { setError(null); setLoading(true); fetchRecord() }}
          className="text-sm text-primary hover:underline"
        >
          重试
        </button>
      </div>
    )
  }

  if (!record) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">记录未找到</p>
        <Link href="/today" className="text-sm text-primary mt-2 inline-block">
          返回仪表盘
        </Link>
      </div>
    )
  }

  let conversation: { role: string; content: string; timestamp: string }[] = []
  try {
    conversation = JSON.parse(record.conversation)
  } catch {
    // corrupted conversation data
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <Link
          href="/today"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          返回仪表盘
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">
            {record.title ?? "每日记录"}
          </h1>
          {record.mood && <span className="text-xl">{record.mood}</span>}
        </div>
        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <CalendarDays className="w-3.5 h-3.5" />
            {new Date(record.date).toLocaleDateString("zh-CN", {
              year: "numeric",
              month: "long",
              day: "numeric",
              weekday: "long",
            })}
          </span>
          {record.hoursWorked && (
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {record.hoursWorked} 小时
            </span>
          )}
        </div>
      </div>

      {/* Summary */}
      {record.summary && (
        <div className="rounded-xl border bg-card p-5">
          <p className="text-sm font-medium mb-1">AI 总结</p>
          <p className="text-sm text-muted-foreground">{record.summary}</p>
        </div>
      )}

      {/* Work Items */}
      {record.workItems.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-3">
            工作事项 ({record.workItems.length})
          </h3>
          <div className="space-y-2">
            {record.workItems.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border bg-card p-4"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{item.title}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {item.type}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${
                      item.status === "completed"
                        ? "text-green-600 border-green-300"
                        : "text-amber-600 border-amber-300"
                    }`}
                  >
                    {item.status === "completed" ? "已完成" : "进行中"}
                  </Badge>
                </div>
                {item.description && (
                  <p className="text-xs text-muted-foreground mt-1.5">
                    {item.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Knowledge */}
      {record.knowledgeItems.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-3">
            学习知识 ({record.knowledgeItems.length})
          </h3>
          <div className="space-y-2">
            {record.knowledgeItems.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border bg-card p-4"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium">{item.title}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {item.category}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{item.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Achievements */}
      {record.achievements.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-3">
            成就 ({record.achievements.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {record.achievements.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary text-sm"
              >
                <span>{a.icon ?? "⭐"}</span>
                <span>{a.title}</span>
                {a.value != null && (
                  <span className="text-xs text-muted-foreground">
                    +{a.value}
                    {a.unit ?? ""}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Conversation */}
      <div>
        <h3 className="text-sm font-medium mb-3">对话记录</h3>
        <div className="rounded-xl border bg-card p-5 space-y-4">
          {conversation.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-2.5 ${
                msg.role === "user" ? "flex-row-reverse" : ""
              }`}
            >
              <div
                className={`rounded-xl px-4 py-2.5 text-sm max-w-[80%] ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground"
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
