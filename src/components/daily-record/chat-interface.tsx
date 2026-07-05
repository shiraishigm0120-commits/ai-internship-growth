"use client"

import { useState, useRef, useEffect } from "react"
import { motion } from "framer-motion"
import { Sparkles, Save, RotateCcw } from "lucide-react"
import { useChatStream } from "@/hooks/use-chat-stream"
import { useActiveInternship } from "@/hooks/use-active-internship"
import { ChatBubble, TypingIndicator } from "./chat-bubble"
import { ChatInput } from "./chat-input"
import { ExtractionSummary } from "./extraction-summary"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import type { ExtractedData } from "@/types"

export function DailyRecordChat({ onSaved }: { onSaved?: () => void }) {
  const { internship } = useActiveInternship()
  const { messages, isLoading, isComplete, summaryReady, sendMessage, reset, clearDraft } =
    useChatStream(internship?.id)
  const [showExtraction, setShowExtraction] = useState(false)
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null)
  const [isExtracting, setIsExtracting] = useState(false)
  const [saved, setSaved] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // When summary is ready, extract data
  useEffect(() => {
    if (summaryReady && !showExtraction) {
      handleExtract()
    }
  }, [summaryReady])

  const handleExtract = async () => {
    setIsExtracting(true)
    setShowExtraction(true)

    try {
      const response = await fetch("/api/daily-records/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation: messages }),
      })

      if (response.ok) {
        const data = await response.json()
        setExtractedData(data.extracted)
      }
    } catch (error) {
      console.error("Extraction failed:", error)
    } finally {
      setIsExtracting(false)
    }
  }

  const handleSave = async () => {
    if (!internship?.id) return
    try {
      const response = await fetch("/api/daily-records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          internshipId: internship.id,
          conversation: messages,
          extracted: extractedData, // Pass already-extracted data to avoid re-running AI
        }),
      })

      if (response.ok) {
        clearDraft()
        setSaved(true)
        setShowExtraction(false)
        toast.success("今日记录保存成功！")
        onSaved?.()
      } else {
        const json = await response.json()
        toast.error(json.error ?? "保存失败，请重试")
      }
    } catch {
      toast.error("保存失败，请检查网络后重试")
    }
  }

  if (saved) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center py-20 text-center"
      >
        <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
          <Sparkles className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-xl font-semibold">今日记录已完成！</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-sm">
          AI 已自动提取你的工作成果、学习知识和技能。你可以在仪表盘中查看今天的成长数据。
        </p>
        <div className="flex gap-3 mt-6">
          <Button variant="outline" onClick={() => setSaved(false)}>
            查看记录
          </Button>
          <Button onClick={reset}>
            <RotateCcw className="w-4 h-4 mr-2" />
            开始新记录
          </Button>
        </div>
      </motion.div>
    )
  }

  return (
    <div className="relative">
      {/* Chat Card */}
      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3 border-b bg-muted/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm font-medium">AI 导师</span>
          </div>
          <span className="text-xs text-muted-foreground">
            {new Date().toLocaleDateString("zh-CN", {
              year: "numeric",
              month: "long",
              day: "numeric",
              weekday: "long",
            })}
          </span>
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          className="h-[500px] overflow-y-auto px-5 py-4 space-y-4"
        >
          {messages.map((msg, i) => (
            <ChatBubble
              key={i}
              message={msg}
              isLatest={i === messages.length - 1}
            />
          ))}
          {isLoading && <TypingIndicator />}
        </div>

        {/* Input */}
        <ChatInput
          onSend={sendMessage}
          isLoading={isLoading}
          disabled={summaryReady}
        />
      </div>

      {/* Start interview hint (when no messages yet) */}
      {messages.length <= 1 && !isLoading && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center text-xs text-muted-foreground mt-4"
        >
          AI 会像导师一样，一步一步引导你回顾今天的工作。
          <br />
          放松心情，像聊天一样自然回答就好。
        </motion.p>
      )}

      {/* Extraction Panel */}
      <ExtractionSummary
        data={extractedData}
        isLoading={isExtracting}
        onSave={handleSave}
        onEdit={() => {}}
        onCancel={() => setShowExtraction(false)}
      />
    </div>
  )
}
