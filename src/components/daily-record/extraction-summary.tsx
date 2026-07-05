"use client"

import { motion, AnimatePresence } from "framer-motion"
import {
  CheckCircle,
  BookOpen,
  Zap,
  Trophy,
  X,
  Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { ExtractedData } from "@/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

interface ExtractionSummaryProps {
  data: ExtractedData | null
  isLoading: boolean
  onSave: () => void
  onEdit: () => void
  onCancel: () => void
}

export function ExtractionSummary({
  data,
  isLoading,
  onSave,
  onEdit,
  onCancel,
}: ExtractionSummaryProps) {
  if (!data && !isLoading) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 20 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="fixed right-0 top-0 h-screen w-[420px] max-w-[90vw] bg-card border-l shadow-2xl z-40 overflow-y-auto"
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold">AI 提取结果</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                请确认以下自动提取的内容
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={onCancel}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : data ? (
            <div className="space-y-6">
              {/* Summary */}
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/10">
                <p className="text-sm font-medium mb-1">今日总结</p>
                <p className="text-sm text-muted-foreground">{data.summary}</p>
                {data.mood && (
                  <p className="text-lg mt-2">心情：{data.mood}</p>
                )}
              </div>

              {/* Work Items */}
              {data.workItems.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <h4 className="text-sm font-medium">
                      工作事项 ({data.workItems.length})
                    </h4>
                  </div>
                  <div className="space-y-2">
                    {data.workItems.map((item, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="p-3 rounded-lg bg-secondary/50 text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{item.title}</span>
                          <Badge variant="secondary" className="text-[10px]">
                            {item.type}
                          </Badge>
                        </div>
                        <div className="flex gap-1.5 mt-1.5">
                          {item.tags.map((tag) => (
                            <span
                              key={tag}
                              className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Knowledge */}
              {data.knowledge.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <BookOpen className="w-4 h-4 text-blue-500" />
                    <h4 className="text-sm font-medium">
                      学习知识 ({data.knowledge.length})
                    </h4>
                  </div>
                  <div className="space-y-2">
                    {data.knowledge.map((k, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{k.title}</span>
                          <Badge
                            variant="outline"
                            className="text-[10px] text-blue-600 border-blue-300"
                          >
                            {k.masteryLevel === "proficient"
                              ? "熟练"
                              : k.masteryLevel === "intermediate"
                                ? "掌握中"
                                : k.masteryLevel === "beginner"
                                  ? "初学"
                                  : "接触"}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {k.content.slice(0, 120)}
                        </p>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Skills */}
              {data.skills.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="w-4 h-4 text-amber-500" />
                    <h4 className="text-sm font-medium">识别技能</h4>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {data.skills.map((skill) => (
                      <Badge key={skill} variant="secondary">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Achievements */}
              {data.achievements.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Trophy className="w-4 h-4 text-purple-500" />
                    <h4 className="text-sm font-medium">成就</h4>
                  </div>
                  <div className="space-y-2">
                    {data.achievements.map((a, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 p-2 rounded-lg bg-purple-50 dark:bg-purple-950/20 text-sm"
                      >
                        <span className="text-lg">{a.icon}</span>
                        <div>
                          <p className="font-medium text-sm">{a.title}</p>
                          {a.value != null && (
                            <p className="text-xs text-muted-foreground">
                              +{a.value}
                              {a.unit ?? ""}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t sticky bottom-0 bg-card pb-4">
                <Button variant="outline" className="flex-1" onClick={onEdit}>
                  编辑修改
                </Button>
                <Button className="flex-1" onClick={onSave}>
                  确认保存
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
