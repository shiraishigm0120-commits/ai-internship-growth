"use client"

import { useState } from "react"
import { Share2, Copy, Check, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

interface ShareButtonProps {
  type?: "timeline" | "report"
  reportId?: string
}

export function ShareButton({ type = "timeline", reportId }: ShareButtonProps) {
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  async function handleShare() {
    setLoading(true)
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, reportId }),
      })
      const json = await res.json()
      if (json.error) {
        toast.error(json.error)
        return
      }

      const url = `${window.location.origin}/share/${json.data.token}`
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success("分享链接已复制到剪贴板", {
        description: "链接 7 天内有效",
      })
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("生成分享链接失败")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleShare}
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      ) : copied ? (
        <Check className="w-4 h-4 mr-2 text-green-500" />
      ) : (
        <Share2 className="w-4 h-4 mr-2" />
      )}
      {copied ? "已复制" : "分享"}
    </Button>
  )
}
