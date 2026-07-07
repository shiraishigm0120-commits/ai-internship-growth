"use client"

import { useState } from "react"
import { Sparkles, Mail, Loader2, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import Link from "next/link"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [resetUrl, setResetUrl] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email) {
      toast.error("请输入邮箱")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const json = await res.json()
      if (json.resetUrl) {
        setResetUrl(json.resetUrl)
      }
      setSent(true)
    } catch {
      toast.error("请求失败，请重试")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary mb-4">
            <Sparkles className="w-6 h-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            找回密码
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            输入注册邮箱，获取密码重置链接
          </p>
        </div>

        {sent ? (
          <div className="rounded-xl border bg-card p-6 space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
              <Mail className="w-6 h-6 text-green-600" />
            </div>
            <p className="text-sm font-medium">重置链接已生成</p>
            <p className="text-xs text-muted-foreground">
              如果该邮箱已注册，请点击下方链接重置密码（有效期 1 小时）
            </p>
            {resetUrl && (
              <a
                href={resetUrl}
                className="block text-sm text-primary hover:underline break-all"
              >
                {resetUrl}
              </a>
            )}
            <Link href="/login">
              <Button variant="outline" size="sm" className="mt-2">
                <ArrowLeft className="w-4 h-4 mr-2" />
                返回登录
              </Button>
            </Link>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="rounded-xl border bg-card p-6 space-y-4"
          >
            <div>
              <label className="text-sm font-medium block mb-1.5">邮箱</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9"
                  autoFocus
                />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              发送重置链接
            </Button>
            <Link href="/login">
              <Button variant="ghost" size="sm" className="w-full">
                <ArrowLeft className="w-4 h-4 mr-2" />
                返回登录
              </Button>
            </Link>
          </form>
        )}
      </div>
    </div>
  )
}
