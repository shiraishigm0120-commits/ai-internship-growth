"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import {
  Star,
  FileText,
  BookOpen,
  Bookmark,
  FileOutput,
  Plus,
  Trash2,
  CheckCircle,
  Copy,
  AlertCircle,
  RefreshCw,
  Search,
} from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ExportMenu } from "@/components/export/export-menu"
import { toast } from "sonner"

type Tab = "star" | "resume" | "knowledge" | "reports"

interface STARCase {
  id: string
  title: string
  situation: string
  task: string
  action: string
  result: string
  skills: string[]
  isVerified: boolean
  starRating: number
}

interface ResumeMaterial {
  id: string
  category: string
  title?: string
  content: string
  isAiGenerated: boolean
  isPinned: boolean
}

interface KnowledgeItem {
  id: string
  title: string
  content: string
  category: string
  tags: string[]
  masteryLevel: string
  isBookmarked: boolean
  relatedIds: string | null
}

export default function AssetsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>("star")
  const [starCases, setStarCases] = useState<STARCase[]>([])
  const [materials, setMaterials] = useState<ResumeMaterial[]>([])
  const [knowledge, setKnowledge] = useState<KnowledgeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [genStarLoading, setGenStarLoading] = useState(false)

  async function generateRecruitmentStar() {
    setGenStarLoading(true)
    try {
      const res = await fetch("/api/star-cases/generate-recruitment", { method: "POST" })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? "生成失败")
      } else {
        await fetchAll()
      }
    } catch {
      setError("生成失败，请稍后重试")
    } finally {
      setGenStarLoading(false)
    }
  }

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
      return
    }
    if (status === "authenticated") {
      fetchAll()
    }
  }, [status])

  async function fetchAll() {
    try {
      const [starRes, matRes, knowRes] = await Promise.all([
        fetch("/api/star-cases"),
        fetch("/api/resume-materials"),
        fetch("/api/knowledge"),
      ])
      const [starJson, matJson, knowJson] = await Promise.all([
        starRes.json(),
        matRes.json(),
        knowRes.json(),
      ])
      setStarCases(starJson.data ?? [])
      setMaterials(matJson.data ?? [])
      setKnowledge(knowJson.data ?? [])
    } catch (err) {
      console.error("Failed to fetch assets:", err)
      setError(err instanceof Error ? err.message : "获取资产数据失败")
    } finally {
      setLoading(false)
    }
  }

  async function toggleVerify(id: string) {
    const sc = starCases.find((s) => s.id === id)
    if (!sc) return
    try {
      await fetch(`/api/star-cases/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isVerified: !sc.isVerified }),
      })
      setStarCases((prev) =>
        prev.map((s) => (s.id === id ? { ...s, isVerified: !s.isVerified } : s))
      )
    } catch {
      toast.error("操作失败")
    }
  }

  async function deleteStarCase(id: string) {
    try {
      await fetch(`/api/star-cases/${id}`, { method: "DELETE" })
      setStarCases((prev) => prev.filter((s) => s.id !== id))
      toast.success("已删除")
    } catch {
      toast.error("删除失败")
    }
  }

  function copyContent(text: string) {
    navigator.clipboard.writeText(text)
    toast.success("已复制到剪贴板")
  }

  async function toggleBookmark(id: string) {
    try {
      const res = await fetch(`/api/knowledge/${id}`, { method: "PATCH" })
      const json = await res.json()
      if (json.data) {
        setKnowledge((prev) =>
          prev.map((k) => (k.id === id ? { ...k, isBookmarked: json.data.isBookmarked } : k))
        )
      }
    } catch {
      toast.error("操作失败")
    }
  }

  async function updateStarRating(id: string, rating: number) {
    try {
      await fetch(`/api/star-cases/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ starRating: rating }),
      })
      setStarCases((prev) =>
        prev.map((s) => (s.id === id ? { ...s, starRating: rating } : s))
      )
    } catch {
      toast.error("操作失败")
    }
  }

  const lowerQuery = searchQuery.toLowerCase().trim()

  const filteredStarCases = lowerQuery
    ? starCases.filter(
        (sc) =>
          sc.title.toLowerCase().includes(lowerQuery) ||
          sc.situation.toLowerCase().includes(lowerQuery) ||
          sc.task.toLowerCase().includes(lowerQuery) ||
          sc.action.toLowerCase().includes(lowerQuery) ||
          sc.result.toLowerCase().includes(lowerQuery) ||
          sc.skills.some((s) => s.toLowerCase().includes(lowerQuery))
      )
    : starCases

  const filteredMaterials = lowerQuery
    ? materials.filter(
        (m) =>
          m.content.toLowerCase().includes(lowerQuery) ||
          (m.title && m.title.toLowerCase().includes(lowerQuery))
      )
    : materials

  const filteredKnowledge = lowerQuery
    ? knowledge.filter(
        (k) =>
          k.title.toLowerCase().includes(lowerQuery) ||
          k.content.toLowerCase().includes(lowerQuery) ||
          k.tags.some((t) => t.toLowerCase().includes(lowerQuery))
      )
    : knowledge

  if (status === "loading" || loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-[400px] rounded-2xl" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle className="w-10 h-10 text-red-400 mb-3" />
        <p className="text-sm text-red-500 mb-4">{error}</p>
        <Button variant="outline" size="sm" onClick={() => { setError(null); fetchAll() }}>
          <RefreshCw className="w-4 h-4 mr-2" />
          重试
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            能力资产
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            你的 STAR 案例、简历素材和知识网络
          </p>
        </div>
        <ExportMenu />
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 rounded-xl bg-muted">
        {(
          [
            { key: "star", label: "STAR 案例", icon: Star, count: starCases.length },
            { key: "resume", label: "简历素材", icon: FileText, count: materials.length },
            { key: "knowledge", label: "知识库", icon: BookOpen, count: knowledge.length },
            { key: "reports", label: "报告", icon: FileOutput, count: undefined as number | undefined },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {"count" in tab && tab.count !== undefined && (
              <span className="text-xs text-muted-foreground">({tab.count})</span>
            )}
          </button>
        ))}
      </div>

      {/* Search bar (not shown on reports tab) */}
      {activeTab !== "reports" && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索..."
            className="pl-9"
          />
        </div>
      )}

      {/* STAR Cases */}
      {activeTab === "star" && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" onClick={generateRecruitmentStar} disabled={genStarLoading}>
              {genStarLoading ? "生成中…" : "✨ 从招聘数据生成 STAR"}
            </Button>
          </div>
          {filteredStarCases.length === 0 ? (
            <div className="rounded-xl border bg-card p-8 text-center">
              <Star className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                {searchQuery ? "没有匹配的 STAR 案例" : "完成每日记录后，AI 会自动生成 STAR 案例"}
              </p>
            </div>
          ) : (
            filteredStarCases.map((sc) => (
              <div key={sc.id} className="rounded-xl border bg-card p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{sc.title}</h3>
                    {sc.isVerified && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300">
                        已验证
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleVerify(sc.id)}
                      aria-label={sc.isVerified ? "取消验证" : "验证案例"}
                    >
                      <CheckCircle className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteStarCase(sc.id)}
                      aria-label="删除案例"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </Button>
                  </div>
                </div>

                {/* Star Rating */}
                <div className="flex items-center gap-0.5 mb-3">
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <button
                      key={rating}
                      onClick={() => updateStarRating(sc.id, rating)}
                      className="transition-colors hover:text-amber-400"
                      aria-label={`${rating} 星`}
                    >
                      <Star
                        className={`w-4 h-4 ${
                          rating <= sc.starRating
                            ? "fill-amber-400 text-amber-400"
                            : "text-muted-foreground/30"
                        }`}
                      />
                    </button>
                  ))}
                </div>

                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>
                    <span className="font-medium text-foreground">S: </span>
                    {sc.situation}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">T: </span>
                    {sc.task}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">A: </span>
                    {sc.action}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">R: </span>
                    {sc.result}
                  </p>
                </div>

                {sc.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {sc.skills.map((s, i) => (
                      <span
                        key={i}
                        className="text-xs px-2 py-0.5 rounded bg-muted"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Resume Materials */}
      {activeTab === "resume" && (
        <div className="space-y-3">
          {filteredMaterials.length === 0 ? (
            <div className="rounded-xl border bg-card p-8 text-center">
              <FileText className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                {searchQuery ? "没有匹配的简历素材" : "在简历素材页面生成 AI 简历素材"}
              </p>
            </div>
          ) : (
            filteredMaterials.map((mat) => (
              <div
                key={mat.id}
                className="rounded-xl border bg-card p-4 group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs px-1.5 py-0.5 rounded bg-muted">
                        {mat.category === "bullet"
                          ? "要点"
                          : mat.category === "skill_block"
                            ? "技能"
                            : "总结"}
                      </span>
                      {mat.title && (
                        <span className="text-xs text-muted-foreground">
                          {mat.title}
                        </span>
                      )}
                    </div>
                    <p className="text-sm">{mat.content}</p>
                  </div>
                  <button
                    onClick={() => copyContent(mat.content)}
                    aria-label="复制内容"
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded hover:bg-muted"
                  >
                    <Copy className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Knowledge */}
      {activeTab === "knowledge" && (
        <div className="space-y-3">
          {filteredKnowledge.length === 0 ? (
            <div className="rounded-xl border bg-card p-8 text-center">
              <BookOpen className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                {searchQuery ? "没有匹配的知识条目" : "每日记录中 AI 提取的知识将在这里展示"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredKnowledge.map((k) => {
                  // Parse relatedIds if it's a JSON string
                  let relatedIdsParsed: string[] = []
                  if (k.relatedIds) {
                    try { relatedIdsParsed = JSON.parse(k.relatedIds) } catch { /* ignore */ }
                  }

                  return (
                <div key={k.id} className="rounded-xl border bg-card p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded ${
                        k.category === "technical"
                          ? "bg-blue-100 dark:bg-blue-900/20 text-blue-700"
                          : k.category === "soft_skill"
                            ? "bg-green-100 dark:bg-green-900/20 text-green-700"
                            : k.category === "business"
                              ? "bg-purple-100 dark:bg-purple-900/20 text-purple-700"
                              : "bg-muted"
                      }`}
                    >
                      {k.category}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {k.masteryLevel}
                    </span>
                    <button
                      onClick={() => toggleBookmark(k.id)}
                      className="ml-auto transition-colors hover:text-amber-400"
                      aria-label={k.isBookmarked ? "取消收藏" : "收藏"}
                    >
                      <Bookmark
                        className={`w-4 h-4 ${
                          k.isBookmarked
                            ? "fill-amber-400 text-amber-400"
                            : "text-muted-foreground"
                        }`}
                      />
                    </button>
                  </div>
                  <h4 className="font-medium text-sm mb-1">{k.title}</h4>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {k.content}
                  </p>
                  {k.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {k.tags.map((t, i) => (
                        <span
                          key={i}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                  {relatedIdsParsed.length > 0 && (
                    <div className="mt-2 text-[10px] text-muted-foreground">
                      相关知识点 ({relatedIdsParsed.length})
                    </div>
                  )}
                </div>
              )})}
            </div>
          )}
        </div>
      )}

      {/* Reports */}
      {activeTab === "reports" && (
        <div className="rounded-xl border bg-card p-8 text-center">
          <FileOutput className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-4">
            导出你的实习成长报告
          </p>
          <Button
            variant="outline"
            onClick={() => router.push("/reports")}
          >
            前往报告页面
          </Button>
        </div>
      )}
    </div>
  )
}
