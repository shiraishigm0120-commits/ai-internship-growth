"use client"

import { Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

interface AIInsightCardProps {
  insight: string
  className?: string
}

export function AIInsightCard({ insight, className }: AIInsightCardProps) {
  return (
    <div className={cn("rounded-xl border bg-card p-5", className)}>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-6 h-6 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
          <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
        </div>
        <p className="text-sm font-medium">AI 成长洞察</p>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed">{insight}</p>
    </div>
  )
}
