"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Sparkles, Mail, Lock, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import Link from "next/link"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password) {
      toast.error("请输入邮箱和密码")
      return
    }

    setLoading(true)
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    })

    if (result?.error) {
      toast.error("邮箱或密码错误")
      setLoading(false)
    } else {
      router.push("/today")
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
            AI 实习成长系统
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            每天 3~5 分钟，AI 帮你整理成长
          </p>
        </div>

        <form onSubmit={handleLogin} className="rounded-xl border bg-card p-6 space-y-4">
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
          <div>
            <label className="text-sm font-medium block mb-1.5">密码</label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="password"
                placeholder="输入密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            登录
          </Button>
        </form>

        <div className="space-y-2 text-center mt-4">
          <p className="text-sm text-muted-foreground">
            还没有账号？
            <Link href="/register" className="text-primary ml-1 hover:underline">
              注册
            </Link>
          </p>
          <Link
            href="/forgot-password"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            忘记密码？
          </Link>
        </div>
      </div>
    </div>
  )
}
