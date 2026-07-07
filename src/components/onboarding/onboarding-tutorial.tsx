"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowRight, X, Sparkles, MessageCircle, TrendingUp, Briefcase } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Step {
  icon: typeof Sparkles
  title: string
  description: string
}

const STEPS: Step[] = [
  {
    icon: Sparkles,
    title: "欢迎来到 AI 实习成长系统",
    description: "我是你的 AI 职业教练。每天花 3~5 分钟记录实习经历，我会帮你发现成长、积累能力、构建简历。",
  },
  {
    icon: MessageCircle,
    title: "每天一次 AI 访谈",
    description: "打开「今天」页面，和 AI 教练聊一聊你今天做了什么。AI 会追问细节、帮你反思，并提取关键成果。",
  },
  {
    icon: TrendingUp,
    title: "追踪成长轨迹",
    description: "在「成长时间轴」中查看你的能力变化曲线、里程碑事件和职业资本积累。设定目标，持续进步。",
  },
  {
    icon: Briefcase,
    title: "积累能力资产",
    description: "AI 自动将你的经历转化为 STAR 案例、简历素材和知识网络。面试前打开「能力资产」，最佳素材已在等你。",
  },
]

export function OnboardingTutorial() {
  const [visible, setVisible] = useState(false)
  const [step, setStep] = useState(0)

  useEffect(() => {
    const dismissed = localStorage.getItem("onboarding-dismissed")
    if (!dismissed) {
      setVisible(true)
    }
  }, [])

  function dismiss() {
    localStorage.setItem("onboarding-dismissed", "true")
    setVisible(false)
  }

  function next() {
    if (step < STEPS.length - 1) {
      setStep(step + 1)
    } else {
      dismiss()
    }
  }

  const current = STEPS[step]

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) dismiss()
          }}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            className="bg-card border rounded-2xl shadow-xl max-w-md w-full p-6 relative"
          >
            <button
              onClick={dismiss}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10">
                <current.icon className="w-7 h-7 text-primary" />
              </div>

              <div>
                <h2 className="text-lg font-bold">{current.title}</h2>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                  {current.description}
                </p>
              </div>

              <div className="flex items-center justify-between pt-4">
                <div className="flex gap-2">
                  {STEPS.map((_, i) => (
                    <div
                      key={i}
                      className={`w-2 h-2 rounded-full transition-colors ${
                        i === step ? "bg-primary" : "bg-muted"
                      }`}
                    />
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={dismiss}>
                    跳过
                  </Button>
                  <Button size="sm" onClick={next}>
                    {step < STEPS.length - 1 ? "下一步" : "开始使用"}
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
