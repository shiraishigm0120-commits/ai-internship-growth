"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Sparkles, Lock, Loader2, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import Link from "next/link"

export default function ResetPasswordPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token") ?? ""

  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!password || !confirm) {
      toast.error("请填写所有字段")
      return
    }
    if (password.length < 6) {
      toast.error("密码至少需要 6 个字符")
      return
    }
    if (password !== confirm) {
      toast.error("两次密码输入不一致")
      return
    }
    if (!token) {
      toast.error("无效的重置链接")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      })
      const json = await res.json()
      if (res.ok) {
        toast.success("密码已重置，请登录")
        router.push("/login")
      } else {
        toast.error(json.error ?? "重置失败")
      }
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
            重置密码
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            设置新密码
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-xl border bg-card p-6 space-y-4"
        >
          <div>
            <label className="text-sm font-medium block mb-1.5">新密码</label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="password"
                placeholder="至少 6 个字符"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-9"
                autoFocus
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">确认密码</label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="password"
                placeholder="再次输入密码"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            重置密码
          </Button>
          <Link href="/login">
            <Button variant="ghost" size="sm" className="w-full">
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回登录
            </Button>
          </Link>
        </form>
      </div>
    </div>
  )
}
