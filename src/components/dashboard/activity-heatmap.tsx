"use client"

import { cn } from "@/lib/utils"

interface HeatmapProps {
  data: { date: string; count: number }[]
}

export function ActivityHeatmap({ data }: HeatmapProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
        记录后这里会显示你的活跃度热力图
      </div>
    )
  }

  const maxCount = Math.max(...data.map((d) => d.count), 1)

  // Generate last 28 days grid
  const today = new Date()
  const days: { date: string; count: number; dayOfWeek: number }[] = []

  for (let i = 27; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().slice(0, 10)
    const found = data.find((r) => r.date.slice(0, 10) === dateStr)
    days.push({
      date: dateStr,
      count: found?.count ?? 0,
      dayOfWeek: d.getDay(),
    })
  }

  function getColor(count: number): string {
    if (count === 0) return "bg-secondary dark:bg-muted/20"
    const intensity = count / maxCount
    if (intensity > 0.7) return "bg-primary/80"
    if (intensity > 0.4) return "bg-primary/50"
    if (intensity > 0.1) return "bg-primary/20"
    return "bg-primary/10"
  }

  return (
    <div className="flex gap-1">
      {Array.from({ length: 7 }).map((_, dayOfWeek) => (
        <div key={dayOfWeek} className="flex flex-col gap-1">
          {days
            .filter((d) => d.dayOfWeek === dayOfWeek)
            .map((d) => (
              <div
                key={d.date}
                className={cn(
                  "w-3 h-3 rounded-sm transition-colors",
                  getColor(d.count)
                )}
                title={`${d.date}: ${d.count} 字`}
              />
            ))}
        </div>
      ))}
    </div>
  )
}
