import OpenAI from "openai"
import type { ExtractedData } from "@/types"

const EXTRACTION_SYSTEM_PROMPT = `你是一个专业的数据提取系统。你需要从实习生的每日对话记录中提取结构化数据。

请从以下对话中提取以下信息，并以严格的JSON格式返回：

{
  "workItems": [
    {
      "type": "工作类型，从以下选项中选择最合适的：招聘、培训、员工关系、薪酬、绩效、Excel、PPT、数据分析、会议、行政、运营、开发、测试、设计、产品、项目管理、其他",
      "title": "简洁的工作任务名称",
      "description": "对这项工作的简要描述",
      "status": "completed 或 in_progress",
      "priority": "low 或 medium 或 high",
      "tags": ["相关标签"],
      "effort": "small 或 medium 或 large"
    }
  ],
  "knowledge": [
    {
      "category": "technical 或 soft_skill 或 business 或 tool 或 process",
      "title": "知识点标题",
      "content": "详细的知识描述",
      "source": "学习来源",
      "tags": ["相关标签"],
      "masteryLevel": "exposed 或 beginner 或 intermediate 或 proficient"
    }
  ],
  "skills": ["掌握的技能名称"],
  "achievements": [
    {
      "title": "成就标题",
      "description": "成就描述",
      "category": "milestone 或 skill_mastery 或 recognition 或 project_completion",
      "icon": "emoji表情",
      "value": 数值,
      "unit": "单位（如次、天、人、%）"
    }
  ],
  "summary": "今日工作的一句话总结",
  "mood": "用户心情emoji",
  "milestoneDetected": false,
  "milestoneTitle": "",
  "milestoneCategory": "first_time 或 achievement 或 promotion 或 insight",
  "skillChanges": [{"name": "技能名", "from": 0, "to": 0}],
  "reflection": "用户的自我反思内容摘要，如果对话中有的话",
  "funnel": {
    "totalApplications": 0,
    "passedScreening": 0,
    "passedBusinessReview": 0,
    "interviewInvited": 0,
    "interviewAttendees": 0,
    "offersSent": 0,
    "offersAccepted": 0,
    "onboarded": 0
  },
  "funnelNames": {
    "screening": "初筛名单（用、号分隔），包含通过和淘汰的人，括号注明淘汰原因",
    "invited": "邀约面试名单（用、号分隔）",
    "interviewed": "实际面试名单（用、号分隔），括号注明放弃/未到",
    "offer": "面试通过/拿到Offer的名单（用、号分隔）",
    "inProcess": "流程中/待谈薪/已拒offer的名单及状态（用、号分隔）"
  },
  "candidates": [
    {
      "name": "候选人姓名",
      "position": "应聘岗位（如抽卡、短剧运营），没提到留空",
      "stageToday": "今日推进到的阶段，从以下选一个：推荐简历、业务筛选、邀约面试、已面试、面试通过、Offer、接受、待入职、已入职、已淘汰",
      "note": "状态备注，如淘汰原因、放弃、待谈薪、已拒offer等，没有留空"
    }
  ]
}

提取规则：
1. workItems：从对话中提取所有具体的工作事项。每项工作都要指定type和tags
2. knowledge：提取用户明确提到的学习内容、新知识、新技能
3. skills：提取用户展示或提到的能力标签
4. achievements：如果用户完成了重要工作、达到里程碑或获得认可，提取为成就
5. summary：用一句话概括今天的主要工作
6. mood：从对话语气判断用户心情
7. milestoneDetected：检测是否是成长里程碑——「第一次」做某事、获得表扬/认可、重大突破、项目完成、技能明显提升
8. skillChanges：如果某个技能今天有明显变化（进步或退步），记录变化。from 和 to 为 1-10 的估值
9. reflection：如果用户在对话中进行了自我反思，提取摘要
10. funnel：从对话中提取招聘漏斗数据（仅当对话中明确提到了相关数字时才填写，否则留0）：
   - totalApplications：简历投递/收到量（或今日推荐/处理的简历数）
   - passedScreening：HR初筛通过数
   - passedBusinessReview：业务部门筛选通过数（推荐给业务的）
   - interviewInvited：邀约面试人数（发出面试邀约并确认的）
   - interviewAttendees：实际到场面试人数
   - offersSent：发出的Offer数量（或面试通过数）
   - offersAccepted：被接受的Offer数量
   - onboarded：实际入职人数
   每个字段只取整数，没有提到的留0，不要编造
11. funnelNames：从对话中提取各阶段的候选人名字（仅当对话中明确提到名字时才填写，否则留空字符串）。screening填写初筛阶段的名单（包含通过和拒绝的人，括号注明淘汰原因），invited填写邀约面试名单，interviewed填写实际面试名单（括号注明放弃/未到），offer填写面试通过/拿到Offer的名单，inProcess填写流程中/待谈薪/已拒offer的人及状态。名字用中文逗号/分号分隔。
12. candidates：这是候选人看板的关键字段。把对话中提到的每一个候选人拆成一条记录，标注 TA「今天推进到了哪个阶段」（stageToday）。规则：
   - 一个人今天最远到达哪个阶段，stageToday 就填那个（如今天被邀约就填「邀约面试」，今天面试了填「已面试」，今天拿offer填「Offer」）。
   - 被淘汰/拒绝的人 stageToday 填「已淘汰」，note 写原因（如「业务筛选拒绝」）。
   - 放弃/取消/已拒offer 的，stageToday 填 TA 放弃前的最远阶段，note 说明（如「面试后放弃」「已拒offer」）。
   - position 填应聘岗位（如「抽卡」「短剧运营」），没提到留空。
   - 只提取明确出现名字的人，不要编造。如果今天没聊到具体候选人，candidates 返回空数组。

注意：
- 只提取对话中明确提到的内容，不要编造
- 如果某项没有内容，返回空数组
- 确保JSON格式正确
- 使用中文描述
- tags 使用中文标签
- milestoneDetected 要严格判断，不要误标日常小事`

const COACH_FEEDBACK_PROMPT = `你是一位资深 Leader，刚看完一位实习生的每日工作记录。请以 Leader 的口吻写一段评价。

格式要求——请用以下 Markdown 结构：

### 如果我是你的Leader，今天我会这样评价你：

**✅ 做得好的：**
- （列出 1-3 件做得好的具体事情）
- （要具体，不要泛泛而谈）

**📈 可以更好的：**
- （给出 1-2 条建设性建议）
- （要有可操作性）

**📚 明天建议：**
- （给出 1-2 条明天可以尝试的具体行动）

**💡 导师洞察：**
- （1 句话总结用户的成长趋势或一个值得注意的观察）

要求：语气温暖而真诚，像真正关心下属成长的好 Leader。具体、可操作、有洞察力。不需要太长，每个部分 2-3 行即可。`

export async function extractDataFromConversation(
  conversation: { role: string; content: string }[],
  openai?: OpenAI,
  model?: string
): Promise<ExtractedData> {
  if (!openai) {
    return getFallbackExtraction(conversation)
  }

  try {
    const response = await openai.chat.completions.create({
      model: model ?? (process.env.AI_MODEL || process.env.OPENAI_MODEL) ?? "gpt-4o-mini",
      messages: [
        { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
        {
          role: "user",
          content: `请从以下实习生对话中提取结构化数据：\n\n${conversation
            .map((m) => `${m.role === "user" ? "实习生" : "导师"}: ${m.content}`)
            .join("\n\n")}`,
        },
      ],
      temperature: 0.3,
      response_format: { type: "json_object" },
    })

    const result = JSON.parse(
      response.choices[0]?.message?.content ?? "{}"
    ) as ExtractedData & {
      milestoneDetected?: boolean
      milestoneTitle?: string
      milestoneCategory?: string
      skillChanges?: { name: string; from: number; to: number }[]
      reflection?: string
    }

    return {
      workItems: result.workItems ?? [],
      knowledge: result.knowledge ?? [],
      skills: result.skills ?? [],
      achievements: result.achievements ?? [],
      summary: result.summary ?? "",
      mood: result.mood,
      milestoneDetected: result.milestoneDetected,
      milestoneTitle: result.milestoneTitle,
      milestoneCategory: result.milestoneCategory,
      skillChanges: result.skillChanges,
      reflection: result.reflection,
      funnel: result.funnel,
      funnelNames: result.funnelNames,
      candidates: result.candidates ?? [],
    }
  } catch (error) {
    console.error("AI extraction failed:", error)
    return getFallbackExtraction(conversation)
  }
}

export async function generateCoachFeedback(
  conversation: { role: string; content: string }[],
  summary: string,
  openai?: OpenAI,
  model?: string
): Promise<string> {
  if (!openai) {
    return getFallbackCoachFeedback(summary)
  }

  try {
    const response = await openai.chat.completions.create({
      model: model ?? (process.env.AI_MODEL || process.env.OPENAI_MODEL) ?? "gpt-4o-mini",
      messages: [
        { role: "system", content: COACH_FEEDBACK_PROMPT },
        {
          role: "user",
          content: `这是实习生今天的工作记录摘要：${summary}\n\n完整对话：\n${conversation
            .map((m) => `${m.role === "user" ? "实习生" : "导师"}: ${m.content}`)
            .join("\n\n")}`,
        },
      ],
      temperature: 0.7,
      max_tokens: 500,
    })

    return response.choices[0]?.message?.content ?? getFallbackCoachFeedback(summary)
  } catch (error) {
    console.error("Coach feedback generation failed:", error)
    return getFallbackCoachFeedback(summary)
  }
}

function getFallbackCoachFeedback(summary: string): string {
  return `### 如果我是你的Leader，今天我会这样评价你：

**✅ 做得好的：**
- 完成了今日的工作任务，值得肯定

**📈 可以更好的：**
- 可以尝试更多量化自己的工作成果

**📚 明天建议：**
- 思考如何在现有任务中寻找更大的挑战

**💡 导师洞察：**
- 持续的积累是成长的关键，继续保持记录的习惯。`
}

function getFallbackExtraction(
  conversation: { role: string; content: string }[]
): ExtractedData {
  const userMessages = conversation
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join("\n")

  return {
    workItems: [
      {
        type: "其他",
        title: "今日工作",
        description: userMessages.slice(0, 200),
        status: "completed",
        priority: "medium",
        tags: ["日常"],
        effort: "medium",
      },
    ],
    knowledge: [],
    skills: [],
    achievements: [],
    summary: "今日工作记录",
    mood: "😊",
    milestoneDetected: false,
    skillChanges: [],
    reflection: undefined,
  }
}
