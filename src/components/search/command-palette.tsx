"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  FileText,
  BookOpen,
  Star,
  CheckCircle,
  Loader2,
} from "lucide-react"

import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command"

interface SearchResult {
  id: string
  title: string | null
  summary?: string | null
  snippet?: string | null
  companyName?: string
  date?: string
  category?: string
  status?: string
  statusLabel?: string
  recordId?: string
}

interface SearchData {
  records: SearchResult[]
  knowledge: SearchResult[]
  starCases: SearchResult[]
  tasks: SearchResult[]
}

const GROUP_ICONS = {
  records: FileText,
  knowledge: BookOpen,
  starCases: Star,
  tasks: CheckCircle,
} as const

const GROUP_LABELS = {
  records: "每日记录",
  knowledge: "知识库",
  starCases: "STAR 案例",
  tasks: "任务",
} as const

const GROUP_NAV_PATH: Record<string, (item: SearchResult) => string> = {
  records: (item) => `/daily-record/${item.id}`,
  knowledge: () => `/assets`,
  starCases: () => `/assets`,
  tasks: () => `/assets`,
}

export function CommandPalette() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchData | null>(null)
  const [loading, setLoading] = useState(false)

  // Debounced search
  useEffect(() => {
    if (!query.trim() || !open) {
      setResults(null)
      return
    }

    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`, {
          signal: controller.signal,
        })
        if (res.ok) {
          const json = await res.json()
          setResults(json)
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return
        console.error("Search failed:", err)
      } finally {
        setLoading(false)
      }
    }, 200)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query, open])

  // Keyboard shortcut: Ctrl+K / Cmd+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  const handleSelect = useCallback(
    (group: string, item: SearchResult) => {
      const getPath = GROUP_NAV_PATH[group]
      if (getPath) {
        const path = getPath(item)
        router.push(path)
      }
      setOpen(false)
    },
    [router]
  )

  const hasResults = results && (
    results.records.length > 0 ||
    results.knowledge.length > 0 ||
    results.starCases.length > 0 ||
    results.tasks.length > 0
  )

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="全局搜索"
      description="搜索每日记录、知识库、STAR 案例和任务"
    >
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder="搜索记录、知识、案例、任务..."
      />

      <CommandList>
        {loading && (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            搜索中...
          </div>
        )}

        {!loading && !query.trim() && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            <p className="mb-1">输入关键词开始搜索</p>
            <p className="text-xs text-muted-foreground/60">
              支持搜索每日记录、知识库、STAR 案例和任务
            </p>
          </div>
        )}

        {!loading && query.trim() && results && !hasResults && (
          <CommandEmpty>未找到相关结果</CommandEmpty>
        )}

        {!loading && results && hasResults && (
          <div className="p-1">
            {(Object.keys(GROUP_LABELS) as Array<keyof typeof GROUP_LABELS>).map(
              (group) => {
                const items = results[group] as SearchResult[]
                if (!items || items.length === 0) return null

                const Icon = GROUP_ICONS[group]

                return (
                  <CommandGroup key={group} heading={GROUP_LABELS[group]}>
                    {items.map((item) => (
                      <CommandItem
                        key={item.id}
                        value={`${group}-${item.id}-${item.title}`}
                        onSelect={() => handleSelect(group, item)}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <Icon className="w-4 h-4 shrink-0 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">
                            {item.title || "（无标题）"}
                          </p>
                          {item.snippet && (
                            <p className="text-xs text-muted-foreground truncate">
                              {item.snippet}
                            </p>
                          )}
                          {group === "records" && item.summary && (
                            <p className="text-xs text-muted-foreground truncate">
                              {item.summary.length > 80
                                ? item.summary.slice(0, 80) + "..."
                                : item.summary}
                            </p>
                          )}
                          {group === "records" && item.date && item.companyName && (
                            <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                              {item.companyName} · {new Date(item.date).toLocaleDateString("zh-CN")}
                            </p>
                          )}
                          {group === "tasks" && item.statusLabel && (
                            <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                              {item.statusLabel}
                            </p>
                          )}
                          {group === "knowledge" && item.category && (
                            <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                              {item.category}
                            </p>
                          )}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )
              }
            )}
          </div>
        )}
      </CommandList>
    </CommandDialog>
  )
}
