"use client"

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts"

interface SkillRadarProps {
  data: { skill: string; level: number }[]
}

export function SkillRadarChart({ data }: SkillRadarProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-sm text-muted-foreground">
        完成每日记录后，技能雷达图将自动生成
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <RadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
        <PolarGrid stroke="oklch(0.92 0 0)" className="dark:opacity-20" />
        <PolarAngleAxis
          dataKey="skill"
          tick={{ fontSize: 12, fill: "oklch(0.556 0 0)" }}
        />
        <PolarRadiusAxis
          angle={30}
          domain={[0, 100]}
          tick={false}
          axisLine={false}
        />
        <Radar
          name="技能"
          dataKey="level"
          stroke="oklch(0.488 0.243 264.376)"
          fill="oklch(0.488 0.243 264.376)"
          fillOpacity={0.2}
          strokeWidth={1.5}
        />
      </RadarChart>
    </ResponsiveContainer>
  )
}
