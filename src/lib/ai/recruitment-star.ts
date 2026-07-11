import OpenAI from "openai"
import type { RecruitmentStats } from "@/lib/recruitment-stats"

const SYSTEM_PROMPT = `你是一位职业发展顾问，擅长把招聘实习经历提炼成 STAR 案例（Situation-Task-Action-Result），用于求职简历和面试。

用户会提供 TA 的招聘工作数据（各岗位、漏斗各阶段人数、候选人亮点）。请生成一个真实、具体、有说服力的 STAR 案例，输出严格 JSON：
{
  "title": "案例标题（简洁有力，如：主导多岗位校招候选人筛选与面试组织）",
  "situation": "情境：所处的团队/业务背景与挑战",
  "task": "任务：你负责的目标与职责",
  "action": "行动：你具体做了什么（方法、流程、工具），要具体",
  "result": "结果：量化成果（用提供的真实数字：筛选X份简历、推荐X人、组织X场面试、X人入职等）",
  "skills": ["体现的能力，如：招聘全流程、候选人评估、跨岗位协调、数据管理"],
  "tags": ["招聘", "校招", "人才筛选"],
  "impact": "一句话影响力总结"
}

要求：
- 全部使用中文
- result 必须使用用户提供的真实数字，不要编造更大的数字
- 语气专业、可信，不浮夸
- action 要体现方法论和主动性`

export async function generateRecruitmentStar(
  stats: RecruitmentStats,
  positions: { position: string; count: number }[],
  openai?: OpenAI,
  model?: string
): Promise<{
  title: string
  situation: string
  task: string
  action: string
  result: string
  skills: string[]
  tags: string[]
  impact: string
} | null> {
  const dataSummary = [
    `累计筛选简历：${stats.totalApplications} 份`,
    `推荐候选人：${stats.recommended} 人`,
    `业务筛选通过：${stats.businessPassed} 人`,
    `邀约面试：${stats.interviewInvited} 人`,
    `组织面试到场：${stats.interviewed} 场`,
    `发出 Offer：${stats.offered} 个`,
    `成功入职：${stats.onboarded} 人`,
    `覆盖岗位：${positions.map((p) => `${p.position}(${p.count}人)`).join("、") || "多个岗位"}`,
  ].join("\n")

  if (!openai) return null

  try {
    const response = await openai.chat.completions.create({
      model: model ?? (process.env.AI_MODEL || process.env.OPENAI_MODEL) ?? "gpt-4o",
      temperature: 0.6,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `我的招聘工作数据：\n${dataSummary}\n\n请生成 STAR 案例。` },
      ],
    })
    const text = response.choices[0]?.message?.content ?? ""
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null
    const parsed = JSON.parse(jsonMatch[0])
    return {
      title: parsed.title ?? "招聘实习经历",
      situation: parsed.situation ?? "",
      task: parsed.task ?? "",
      action: parsed.action ?? "",
      result: parsed.result ?? "",
      skills: Array.isArray(parsed.skills) ? parsed.skills : [],
      tags: Array.isArray(parsed.tags) ? parsed.tags : ["招聘"],
      impact: parsed.impact ?? "",
    }
  } catch (e) {
    console.error("Recruitment STAR generation failed:", e)
    return null
  }
}
