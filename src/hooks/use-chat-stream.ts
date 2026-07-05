"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import type { ChatMessage } from "@/types"

const STORAGE_PREFIX = "chat-draft-"

function loadDraft(internshipId?: string): ChatMessage[] | null {
  if (typeof window === "undefined") return null
  const key = STORAGE_PREFIX + (internshipId ?? "default")
  try {
    const raw = localStorage.getItem(key)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch {
    // corrupted data, ignore
  }
  return null
}

function saveDraft(internshipId: string | undefined, messages: ChatMessage[]) {
  if (typeof window === "undefined") return
  const key = STORAGE_PREFIX + (internshipId ?? "default")
  try {
    localStorage.setItem(key, JSON.stringify(messages))
  } catch {
    // storage full, ignore
  }
}

function clearDraft(internshipId?: string) {
  if (typeof window === "undefined") return
  const key = STORAGE_PREFIX + (internshipId ?? "default")
  try {
    localStorage.removeItem(key)
  } catch {
    // ignore
  }
}

const DEFAULT_MESSAGE: ChatMessage = {
  role: "assistant",
  content: "你好！让我们来回顾一下今天的工作吧。今天在实习中主要做了什么？",
  timestamp: new Date().toISOString(),
}

export function useChatStream(internshipId?: string) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const draft = loadDraft(internshipId)
    return draft ?? [DEFAULT_MESSAGE]
  })
  const [isLoading, setIsLoading] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [summaryReady, setSummaryReady] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  // Persist messages to localStorage whenever they change
  useEffect(() => {
    saveDraft(internshipId, messages)
  }, [messages, internshipId])

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading) return

      const userMsg: ChatMessage = {
        role: "user",
        content: content.trim(),
        timestamp: new Date().toISOString(),
      }

      setMessages((prev) => [...prev, userMsg])
      setIsLoading(true)

      const updatedMessages = [...messages, userMsg]

      abortRef.current = new AbortController()

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: updatedMessages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            internshipId,
          }),
          signal: abortRef.current.signal,
        })

        if (!response.ok) throw new Error("Chat request failed")

        const reader = response.body?.getReader()
        if (!reader) throw new Error("No reader available")

        const decoder = new TextDecoder()
        let assistantContent = ""

        const assistantMsg: ChatMessage = {
          role: "assistant",
          content: "",
          timestamp: new Date().toISOString(),
        }

        setMessages((prev) => [...prev, assistantMsg])

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split("\n")

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6)
              if (data === "[DONE]") {
                // Check if summary is ready
                if (assistantContent.includes("[SUMMARY_READY]")) {
                  setSummaryReady(true)
                  assistantContent = assistantContent.replace(
                    "[SUMMARY_READY]",
                    ""
                  )
                }
                continue
              }

              try {
                const parsed = JSON.parse(data)
                if (parsed.content) {
                  assistantContent += parsed.content
                  setMessages((prev) => {
                    const updated = [...prev]
                    updated[updated.length - 1] = {
                      ...updated[updated.length - 1],
                      content: assistantContent,
                    }
                    return updated
                  })
                }
              } catch {
                // skip parse errors
              }
            }
          }
        }

        setIsComplete(true)
      } catch (error: unknown) {
        if (error instanceof Error && error.name === "AbortError") return
        console.error("Chat error:", error)
      } finally {
        setIsLoading(false)
        abortRef.current = null
      }
    },
    [messages, isLoading, internshipId]
  )

  const reset = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort()
    }
    clearDraft(internshipId)
    setMessages([DEFAULT_MESSAGE])
    setIsLoading(false)
    setIsComplete(false)
    setSummaryReady(false)
  }, [internshipId])

  return {
    messages,
    isLoading,
    isComplete,
    summaryReady,
    sendMessage,
    reset,
    clearDraft: () => clearDraft(internshipId),
  }
}
