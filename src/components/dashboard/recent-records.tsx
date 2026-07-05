"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface RecentRecordsProps {
  records: {
    id: string
    date: string
    title: string
    summary?: string
    mood?: string
  }[]
}

export function RecentRecords({ records }: RecentRecordsProps) {
  if (records.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        还没有记录，去完成第一次每日记录吧
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {records.map((record, i) => (
        <Link
          key={record.id}
          href={`/daily-record/${record.id}`}
          className="flex items-start gap-3 p-3 rounded-lg hover:bg-secondary/50 transition-colors group"
        >
          <div className="w-10 text-right flex-shrink-0">
            <p className="text-xs text-muted-foreground">
              {new Date(record.date).toLocaleDateString("zh-CN", {
                month: "short",
                day: "numeric",
              })}
            </p>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
              {record.title}
            </p>
            {record.summary && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {record.summary}
              </p>
            )}
          </div>
          {record.mood && <span className="text-sm flex-shrink-0">{record.mood}</span>}
          <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1" />
        </Link>
      ))}
    </div>
  )
}
