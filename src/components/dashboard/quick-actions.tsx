"use client"

import Link from "next/link"
import { PencilLine, BookOpen, FileText, FileOutput } from "lucide-react"
import { cn } from "@/lib/utils"

const actions = [
  {
    label: "今日记录",
    description: "开始AI访谈",
    href: "/daily-record",
    icon: PencilLine,
    color: "text-blue-600 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-400",
    primary: true,
  },
  {
    label: "添加学习笔记",
    description: "手动添加知识",
    href: "/knowledge-base",
    icon: BookOpen,
    color: "text-green-600 bg-green-50 dark:bg-green-950/30 dark:text-green-400",
  },
  {
    label: "生成简历素材",
    description: "AI自动生成",
    href: "/resume-materials",
    icon: FileText,
    color: "text-purple-600 bg-purple-50 dark:bg-purple-950/30 dark:text-purple-400",
  },
  {
    label: "导出周报",
    description: "一键生成报告",
    href: "/reports",
    icon: FileOutput,
    color: "text-amber-600 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400",
  },
]

export function QuickActions() {
  return (
    <div className="space-y-2">
      {actions.map((action) => {
        const Icon = action.icon
        return (
          <Link
            key={action.href}
            href={action.href}
            className={cn(
              "flex items-center gap-3 p-3 rounded-lg transition-all hover:shadow-sm",
              action.primary
                ? "bg-primary/5 hover:bg-primary/10 border border-primary/10"
                : "hover:bg-secondary/50"
            )}
          >
            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", action.color)}>
              <Icon className="w-4 h-4" />
            </div>
            <div>
              <p className={cn("text-sm font-medium", action.primary && "text-primary")}>
                {action.label}
              </p>
              <p className="text-xs text-muted-foreground">{action.description}</p>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
