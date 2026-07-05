"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Sparkles, Building2, User, ChevronRight, Check } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

const steps = [
  { key: "welcome", label: "欢迎" },
  { key: "profile", label: "个人信息" },
  { key: "internship", label: "实习信息" },
  { key: "done", label: "完成" },
]

export default function OnboardingPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [step, setStep] = useState(0)

  // Profile
  const [university, setUniversity] = useState("")
  const [major, setMajor] = useState("")

  // Internship
  const [companyName, setCompanyName] = useState("")
  const [position, setPosition] = useState("")
  const [department, setDepartment] = useState("")
  const [startDate, setStartDate] = useState(
    new Date().toISOString().slice(0, 10)
  )

  async function handleFinish() {
    if (!companyName || !position || !startDate) {
      toast.error("请填写公司、岗位和开始日期")
      return
    }

    try {
      // Save user profile (name already set at registration, add university/major)
      await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ university, major }),
      })

      // Create internship
      await fetch("/api/internships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName,
          position,
          department,
          startDate,
        }),
      })
      router.push("/today")
    } catch {
      toast.error("创建失败，请重试")
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        {/* Progress */}
        <div className="flex items-center gap-1 mb-12">
          {steps.map((s, i) => (
            <div key={s.key} className="flex items-center gap-1 flex-1">
              <div
                className={`w-2 h-2 rounded-full transition-all ${
                  i <= step ? "bg-primary scale-125" : "bg-muted"
                }`}
              />
              {i < steps.length - 1 && (
                <div
                  className={`flex-1 h-0.5 rounded transition-all ${
                    i < step ? "bg-primary" : "bg-muted"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* Step 0: Welcome */}
          {step === 0 && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="text-center"
            >
              <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-6">
                <Sparkles className="w-8 h-8 text-primary-foreground" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight mb-3">
                欢迎使用 AI 实习成长系统
              </h1>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto mb-8">
                每天只需 3~5 分钟，AI 会像导师一样引导你回顾工作。
                实习结束时，你将自动获得简历素材、STAR 案例和实习总结。
              </p>
              <Button onClick={() => setStep(1)} size="lg" className="rounded-xl">
                开始设置
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </motion.div>
          )}

          {/* Step 1: Profile */}
          {step === 1 && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
            >
              <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-6">
                <User className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h2 className="text-xl font-bold tracking-tight mb-1">完善个人信息</h2>
              <p className="text-sm text-muted-foreground mb-8">
                帮助 AI 更好地了解你的背景
              </p>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium block mb-1.5">学校</label>
                  <Input
                    value={university}
                    onChange={(e) => setUniversity(e.target.value)}
                    placeholder="例如：北京大学"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1.5">专业</label>
                  <Input
                    value={major}
                    onChange={(e) => setMajor(e.target.value)}
                    placeholder="例如：计算机科学与技术"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <Button variant="outline" onClick={() => setStep(0)} className="flex-1">
                    上一步
                  </Button>
                  <Button onClick={() => setStep(2)} className="flex-1">
                    下一步
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 2: Internship */}
          {step === 2 && (
            <motion.div
              key="internship"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
            >
              <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-6">
                <Building2 className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-xl font-bold tracking-tight mb-1">创建实习档案</h2>
              <p className="text-sm text-muted-foreground mb-8">
                告诉 AI 你正在哪里实习
              </p>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium block mb-1.5">公司名称 *</label>
                  <Input
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="例如：腾讯"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1.5">实习岗位 *</label>
                  <Input
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    placeholder="例如：产品经理实习生"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1.5">部门</label>
                  <Input
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="例如：用户增长部"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1.5">开始日期 *</label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                    上一步
                  </Button>
                  <Button onClick={handleFinish} className="flex-1">
                    完成设置
                    <Check className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
