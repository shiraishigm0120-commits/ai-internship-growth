"use client"

import { useEffect, useState } from "react"
import { ListChecks } from "lucide-react"

interface TodoItem {
  id: string
  label: string
  names: string[]
  priority: "high" | "medium"
  hint?: string
}

export default function TodayTodos() {
  const [items, setItems] = useState<TodoItem[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let active = true
    fetch("/api/recruitment-todos")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (active && json?.data) setItems(json.data.items ?? [])
      })
      .catch(() => {})
      .finally(() => active && setLoaded(true))
    return () => {
      active = false
    }
  }, [])

  // Nothing to do (or not loaded yet): render nothing, keep the page clean.
  if (!loaded || items.length === 0) return null

  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="flex items-center gap-2 mb-3">
        <ListChecks className="w-5 h-5 text-primary" />
        <h2 className="font-semibold">今日待办</h2>
        <span className="text-xs text-muted-foreground">
          （根据候选人看板自动生成）
        </span>
      </div>
      <div className="space-y-2.5">
        {items.map((item) => (
          <div key={item.id} className="flex items-start gap-2.5">
            <span
              className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${
                item.priority === "high" ? "bg-red-500" : "bg-amber-400"
              }`}
            />
            <div className="min-w-0">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-sm font-medium">{item.label}</span>
                <span className="text-xs text-muted-foreground">
                  {item.names.length} 人
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                {item.names.join("、")}
              </p>
              {item.hint && (
                <p className="text-[11px] text-muted-foreground/70 mt-0.5">{item.hint}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
