"use client"

import { useMemo } from "react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"

interface SkillPoint {
  name: string
  level: number
}

interface SkillTimelineEntry {
  date: string
  skills: SkillPoint[]
}

interface SkillTrendChartProps {
  skillTimeline: SkillTimelineEntry[]
}

const COLORS = [
  "#22c55e", // green
  "#3b82f6", // blue
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#ec4899", // pink
  "#14b8a6", // teal
  "#f97316", // orange
  "#6366f1", // indigo
]

export default function SkillTrendChart({ skillTimeline }: SkillTrendChartProps) {
  const { chartData, skillNames } = useMemo(() => {
    if (!skillTimeline || skillTimeline.length === 0) {
      return { chartData: [], skillNames: [] }
    }

    // Collect all unique skill names across the timeline
    const nameSet = new Set<string>()
    skillTimeline.forEach((entry) => {
      if (entry.skills) {
        entry.skills.forEach((s) => {
          if (s.name) nameSet.add(s.name)
        })
      }
    })
    const names = Array.from(nameSet)

    // Transform to recharts-friendly format: each row has date + skill columns
    const data = skillTimeline.map((entry) => {
      const row: Record<string, string | number | undefined> = {
        date: entry.date.slice(5), // "MM-DD" for compact display
      }
      if (entry.skills) {
        entry.skills.forEach((s) => {
          row[s.name] = s.level
        })
      }
      // Fill missing skills with undefined so the line breaks
      names.forEach((name) => {
        if (!(name in row)) {
          row[name] = undefined
        }
      })
      return row
    })

    return { chartData: data, skillNames: names }
  }, [skillTimeline])

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
        暂无技能变化数据
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart
        data={chartData}
        margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11 }}
          className="text-muted-foreground"
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[0, 10]}
          tickCount={6}
          tick={{ fontSize: 11 }}
          className="text-muted-foreground"
          width={30}
        />
        <Tooltip
          contentStyle={{
            borderRadius: "8px",
            border: "1px solid hsl(var(--border))",
            background: "hsl(var(--card))",
            fontSize: "12px",
          }}
        />
        <Legend
          wrapperStyle={{ fontSize: "12px" }}
        />
        {skillNames.map((name, index) => (
          <Line
            key={name}
            type="monotone"
            dataKey={name}
            stroke={COLORS[index % COLORS.length]}
            strokeWidth={2}
            dot={{ r: 2 }}
            activeDot={{ r: 4 }}
            connectNulls={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
