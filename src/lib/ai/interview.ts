import type { ChatMessage } from "@/types"

export const INTERVIEW_SYSTEM_PROMPT = `你是一位关心用户成长的职业导师（Career Coach）。你正在和一位实习生进行每日回顾对话。

## 你的角色
你不是问卷机器，而是一位像关心学生成长的导师。你温暖、专业、有洞察力。你会追问、反思、关联历史、给出建议。

## 核心信念
用户负责回忆今天，你负责发现成长。每次对话的目标不是「收集信息」，而是帮用户看到自己的进步、发现隐藏的学习点、建立成长叙事。

## 追问决策树
用户每次回答后，你必须检查以下维度，缺少什么就追问什么：

1. 具体数字？→ 没有就问「（这件事）有多少/多大/多快？」
2. 过程方法？→ 没有就问「你是怎么做到的？用了什么工具或方法？」
3. 遇到挑战？→ 没提到就问「过程中有什么困难吗？」
4. 学到什么？→ 没提到就问「这件事让你学到了什么？」
5. 如何反思？→ 没提到就问「如果重新做一次，你会怎么做？」
6. 历史关联？→ 如果和历史记录相关，主动问「和上次相比，这次有什么不同？」

追问深度：至少追问 3 层（做了什么 → 怎么做的 → 学到了什么 → 反思与成长）。

## 重要规则
1. 每次只问一个问题，等用户回答后再继续
2. 根据用户的回答灵活调整，不要机械推进
3. 如果用户回答很简短，追问「能再多说一点吗？」
4. 如果用户提到适合做 STAR 案例的经历，在心里标记
5. 如果用户提到具体数字，确认并记录下来
6. 保持对话自然流畅，像微信聊天一样
7. 每次回复控制在 2-4 句话，不要长篇大论
8. 用户说「差不多了」「就这样」「没了」之类的话时，自然收尾
9. 如果用户已经回答得很深（有数据+有方法+有反思），真诚表扬并自然过渡到下一个话题

## 结束对话
当用户表示结束时，先给一句温暖的总结，然后回复 "[SUMMARY_READY]" 作为信号。`

export function buildInterviewContext(context: {
  userName?: string
  companyName?: string
  position?: string
  department?: string
  internshipDay?: number
  recentRecords?: { date: string; title?: string; summary?: string }[]
  activeTasks?: { title: string; status: string }[]
  growthMemory?: {
    summary: string
    skills?: { name: string; level: number }[]
    openChallenges?: { description: string; since: string }[]
    keyLearnings?: { title: string; content: string }[]
    careerCapital?: { category: string; count: number; unit: string }[]
  }
}) {
  const parts: string[] = []

  if (context.userName) {
    parts.push(`实习生：${context.userName}`)
  }
  if (context.companyName) {
    parts.push(`公司：${context.companyName}`)
  }
  if (context.position) {
    parts.push(`岗位：${context.position}`)
  }
  if (context.department) {
    parts.push(`部门：${context.department}`)
  }
  if (context.internshipDay) {
    parts.push(`今天是实习第 ${context.internshipDay} 天`)
  }

  if (context.activeTasks && context.activeTasks.length > 0) {
    parts.push(
      `进行中的任务：${context.activeTasks.map((t) => `${t.title}(${t.status})`).join("、")}`
    )
  }

  if (context.recentRecords && context.recentRecords.length > 0) {
    const recent = context.recentRecords
      .slice(0, 5)
      .map((r) => {
        const date = new Date(r.date).toLocaleDateString("zh-CN")
        return `${date}: ${r.title ?? r.summary ?? "记录"}`
      })
      .join("\n")
    parts.push(`最近记录：\n${recent}`)
  }

  // Growth Memory — 长期记忆注入
  if (context.growthMemory) {
    const gm = context.growthMemory
    const memParts: string[] = []

    if (gm.summary) {
      memParts.push(`成长画像：${gm.summary}`)
    }

    if (gm.skills && gm.skills.length > 0) {
      memParts.push(
        `当前技能：${gm.skills.map((s) => `${s.name}(lv.${s.level})`).join("、")}`
      )
    }

    if (gm.openChallenges && gm.openChallenges.length > 0) {
      memParts.push(
        `未解决的困难：${gm.openChallenges
          .map((c) => `${c.description}（自${c.since}）`)
          .join("、")}`
      )
    }

    if (gm.keyLearnings && gm.keyLearnings.length > 0) {
      memParts.push(
        `近期学习：${gm.keyLearnings.map((l) => l.title).join("、")}`
      )
    }

    if (gm.careerCapital && gm.careerCapital.length > 0) {
      memParts.push(
        `职业资本：${gm.careerCapital
          .map((c) => `${c.category}: ${c.count}${c.unit}`)
          .join("、")}`
      )
    }

    if (memParts.length > 0) {
      parts.push(`\n## 长期记忆（你已经知道关于这个用户的成长信息）\n${memParts.join("\n")}\n
请在对话中自然地运用这些信息：
- 关联过去的困难和进步：「你上次提到XX，现在解决了吗？」
- 关联技能成长：「你已经在XX方面练习了很多，今天有新的突破吗？」
- 关联学习路径：「你之前学了XX，今天的内容和它有什么关系？」`)
    }
  }

  return parts.join("\n")
}

export function buildInitialGreeting(context: {
  userName?: string
  timeOfDay?: string
  hasRecentRecord?: boolean
}) {
  const name = context.userName ?? "同学"
  const timeGreeting =
    context.timeOfDay ??
    (() => {
      const hour = new Date().getHours()
      if (hour < 12) return "上午"
      if (hour < 14) return "中午"
      if (hour < 18) return "下午"
      return "晚上"
    })()

  if (context.hasRecentRecord) {
    return `${timeGreeting}好，${name}！😊 又到了我们每天的成长回顾时间。今天在实习中有什么新的事情发生吗？`
  }

  return `${timeGreeting}好，${name}！😊 让我们来回顾一下今天的工作吧。今天在实习中主要做了什么？`
}
