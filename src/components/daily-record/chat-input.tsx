"use client"

import { useState, useRef, useEffect, type KeyboardEvent } from "react"
import { Send, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface ChatInputProps {
  onSend: (content: string) => void
  isLoading: boolean
  disabled?: boolean
}

export function ChatInput({ onSend, isLoading, disabled }: ChatInputProps) {
  const [value, setValue] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }
  }, [value])

  const handleSend = () => {
    if (!value.trim() || isLoading || disabled) return
    onSend(value.trim())
    setValue("")
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (disabled) {
    return (
      <div className="p-4 border-t bg-muted/30 rounded-b-2xl">
        <p className="text-center text-sm text-muted-foreground">
          对话已完成。请查看 AI 提取的数据并保存。
        </p>
      </div>
    )
  }

  return (
    <div className="p-4 border-t bg-background rounded-b-2xl">
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入你的回答..."
          rows={1}
          className={cn(
            "flex-1 resize-none bg-secondary rounded-xl px-4 py-2.5 text-sm",
            "placeholder:text-muted-foreground/50 outline-none",
            "focus:ring-1.5 focus:ring-ring transition-shadow",
            "max-h-[120px]"
          )}
          disabled={isLoading}
        />
        <button
          onClick={handleSend}
          disabled={!value.trim() || isLoading}
          className={cn(
            "w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all",
            value.trim() && !isLoading
              ? "bg-primary text-primary-foreground hover:opacity-90"
              : "bg-secondary text-muted-foreground cursor-not-allowed"
          )}
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </div>
      <p className="text-[10px] text-muted-foreground/50 mt-1.5 ml-1">
        Enter 发送 · Shift+Enter 换行
      </p>
    </div>
  )
}
