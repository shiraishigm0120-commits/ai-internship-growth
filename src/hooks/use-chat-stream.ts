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

export function hasDraft(internshipId?: string): boolean {
  return loadDraft(internshipId) !== null
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
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const messagesRef = useRef(messages)

  // Keep ref in sync so sendMessage always has the latest messages
  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  // Persist messages to localStorage so drafts survive refreshes
  useEffect(() => {
    saveDraft(internshipId, messages)
  }, [messages, internshipId])

  // Safety net: save on page unload
  useEffect(() => {
    const onUnload = () => saveDraft(internshipId, messagesRef.current)
    window.addEventListener("beforeunload", onUnload)
    return () => window.removeEventListener("beforeunload", onUnload)
  }, [internshipId])

  // Reload draft when internshipId changes (handles async ID resolution)
  useEffect(() => {
    const draft = loadDraft(internshipId)
    if (draft) {
      setMessages(draft)
      setIsComplete(false)
      setSummaryReady(false)
    }
  }, [internshipId])

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading) return

      setError(null)

      const userMsg: ChatMessage = {
        role: "user",
        content: content.trim(),
        timestamp: new Date().toISOString(),
      }

      setMessages((prev) => [...prev, userMsg])
      setIsLoading(true)

      const updatedMessages = [...messagesRef.current, userMsg]

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
        let lineBuffer = ""

        const assistantMsg: ChatMessage = {
          role: "assistant",
          content: "",
          timestamp: new Date().toISOString(),
        }

        setMessages((prev) => [...prev, assistantMsg])

        // 30s timeout to prevent a hanging stream from blocking the UI forever
        const streamTimeout = setTimeout(() => {
          abortRef.current?.abort()
        }, 30_000)

        while (true) {
          const { done, value } = await reader.read()
          if (done) {
            // Process any remaining data in the buffer
            if (lineBuffer && lineBuffer.startsWith("data: ")) {
              const data = lineBuffer.slice(6)
              if (data !== "[DONE]") {
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
                } catch { /* skip malformed remnant */ }
              }
            }
            break
          }

          const chunk = decoder.decode(value, { stream: true })
          lineBuffer += chunk
          const lines = lineBuffer.split("\n")
          // Keep the last potentially incomplete line in the buffer
          lineBuffer = lines.pop() ?? ""

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue
            const data = line.slice(6)
            if (data === "[DONE]") {
              if (assistantContent.includes("[SUMMARY_READY]")) {
                setSummaryReady(true)
                assistantContent = assistantContent.replace("[SUMMARY_READY]", "")
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
              // skip parse errors from malformed chunks
            }
          }
        }

        clearTimeout(streamTimeout)

        setIsComplete(true)
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          setError("响应超时，请重试")
          return
        }
        const msg = err instanceof Error ? err.message : "发送失败，请重试"
        setError(msg)
        console.error("Chat error:", err)
      } finally {
        setIsLoading(false)
        abortRef.current = null
      }
    },
    [isLoading, internshipId]
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
    setError(null)
  }, [internshipId])

  return {
    messages,
    isLoading,
    isComplete,
    summaryReady,
    error,
    sendMessage,
    reset,
    clearDraft: () => clearDraft(internshipId),
  }
}
