"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Sparkles, Mail, Lock, User, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import Link from "next/link"

export default function RegisterPage() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (!name || !email || !password) {
      toast.error("请填写所有字段")
      return
    }
    if (password.length < 6) {
      toast.error("密码至少 6 位")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      })

      if (!res.ok) {
        const json = await res.json()
        toast.error(json.error ?? "注册失败")
        setLoading(false)
        return
      }

      // Auto login after registration
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        toast.error("注册成功，但自动登录失败，请手动登录")
        router.push("/login")
      } else {
        toast.success("注册成功！")
        router.push("/onboarding")
      }
    } catch {
      toast.error("注册失败，请稍后重试")
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
          <h1 className="text-2xl font-bold tracking-tight">创建账号</h1>
          <p className="text-sm text-muted-foreground mt-2">
            注册后即可开始记录实习成长
          </p>
        </div>

        <form onSubmit={handleRegister} className="rounded-xl border bg-card p-6 space-y-4">
          <div>
            <label className="text-sm font-medium block mb-1.5">姓名</label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="你的名字"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="pl-9"
                autoFocus
              />
            </div>
          </div>
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
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">密码</label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="password"
                placeholder="至少 6 位"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            注册
          </Button>
        </form>

        <p className="text-sm text-muted-foreground text-center mt-4">
          已有账号？
          <Link href="/login" className="text-primary ml-1 hover:underline">
            登录
          </Link>
        </p>
      </div>
    </div>
  )
}
