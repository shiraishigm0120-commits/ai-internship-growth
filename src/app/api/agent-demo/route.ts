import { NextResponse } from "next/server"
import { getOpenAI } from "@/lib/ai-provider"

// ---------- 这是 Agent 的 "手" ———————

const TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "check_company_info",
      description: "查询一家公司的工商信息：成立时间、注册资本、员工规模、主营业务",
      parameters: {
        type: "object",
        properties: {
          companyName: {
            type: "string",
            description: "公司名称，例如「字节跳动」「腾讯」",
          },
        },
        required: ["companyName"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_current_time",
      description: "获取当前时间",
      parameters: { type: "object", properties: {} },
    },
  },
]

// 模拟的「公司数据库」
const COMPANY_DB: Record<string, Record<string, string>> = {
  字节跳动: {
    成立时间: "2012年3月",
    注册资本: "5000万人民币",
    员工规模: "约16万人",
    主营业务: "短视频（抖音/TikTok）、信息平台（今日头条）、企业服务（飞书）",
  },
  腾讯: {
    成立时间: "1998年11月",
    注册资本: "6500万人民币",
    员工规模: "约10万人",
    主营业务: "社交（微信/QQ）、游戏、金融科技、云服务",
  },
  阿里巴巴: {
    成立时间: "1999年9月",
    注册资本: "1000万人民币（杭州）",
    员工规模: "约20万人",
    主营业务: "电商（淘宝/天猫）、云计算、本地生活、物流",
  },
}

function lookupCompany(name: string): string {
  for (const [key, info] of Object.entries(COMPANY_DB)) {
    if (key.includes(name) || name.includes(key)) {
      return `${key}：成立时间 ${info["成立时间"]}，${info["注册资本"]}，${info["员工规模"]}，主营${info["主营业务"]}`
    }
  }
  return `未找到「${name}」的信息`
}

function getCurrentTime(): string {
  const now = new Date()
  return `当前时间：${now.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}`
}

// ---------- 核心：Agent 循环 ———————

export async function POST(req: Request) {
  const body = await req.json()
  const userMessage = body.message ?? ""
  const mode = body.mode ?? "agent" // "agent" | "chat"

  if (!userMessage) {
    return NextResponse.json({ error: "message 不能为空" }, { status: 400 })
  }

  const openai = getOpenAI()
  const model = (process.env.AI_MODEL || process.env.OPENAI_MODEL) || "gpt-4o"

  const messages: Array<{
    role: "system" | "user" | "assistant" | "tool"
    content: string
    tool_call_id?: string
    tool_calls?: Array<{
      id: string
      type: "function"
      function: { name: string; arguments: string }
    }>
  }> = [
    {
      role: "system",
      content:
        mode === "agent"
          ? "你是一个公司信息查询助手。用户问公司信息时，你**必须**使用 check_company_info 工具查询，不要凭记忆回答。如果用户问时间，你**必须**使用 get_current_time 工具。你只能使用工具返回的真实数据来回答。"
          : "你是一个公司信息查询助手。请直接回答用户的问题。",
    },
    {
      role: "user",
      content: userMessage,
    },
  ]

  const steps: string[] = [] // 记录每一步做了什么，方便展示 Agent 的思考过程

  // ===== Agent 循环 =====
  for (let loopCount = 0; loopCount < 5; loopCount++) {
    steps.push(`🔄 第 ${loopCount + 1} 轮：发送请求给 LLM…`)

    const response = await openai.chat.completions.create({
      model,
      messages: messages as any, // OpenAI SDK types differ slightly
      tools: mode === "agent" ? TOOLS : undefined,
      tool_choice: mode === "agent" ? "auto" : undefined,
    })

    const choice = response.choices[0]!
    const msg = choice.message

    // 情况 1：LLM 想调工具
    if (msg.tool_calls && msg.tool_calls.length > 0) {
      for (const tc of msg.tool_calls) {
        const fn = (tc as any).function ?? tc
        const toolName = fn.name
        const rawArgs = fn.arguments
        steps.push(`  🔧 LLM 决定调用工具：${toolName}(${rawArgs})`)

        // 执行工具
        let toolResult: string
        if (toolName === "check_company_info") {
          const args = JSON.parse(rawArgs)
          toolResult = lookupCompany(args.companyName)
        } else if (toolName === "get_current_time") {
          toolResult = getCurrentTime()
        } else {
          toolResult = `错误：未知工具 ${toolName}`
        }

        steps.push(`  📦 工具返回：${toolResult}`)

        // 把工具调用和结果都记录到对话里
        messages.push({
          role: "assistant",
          content: "",
          tool_calls: [
            {
              id: tc.id,
              type: "function" as const,
              function: { name: toolName, arguments: rawArgs },
            },
          ],
        })
        messages.push({
          role: "tool",
          content: toolResult,
          tool_call_id: tc.id,
        })
      }
      // 继续循环，让 LLM 根据工具结果回答
      continue
    }

    // 情况 2：LLM 直接回答（没调工具）
    const finalAnswer = msg.content ?? "（无回答）"
    steps.push(`  💬 LLM 最终回答：${finalAnswer.slice(0, 100)}…`)

    return NextResponse.json({
      mode,
      answer: finalAnswer,
      steps,
      toolCallsMade: loopCount,
    })
  }

  return NextResponse.json({
    mode,
    answer: "达到最大循环次数，Agent 未能完成任务",
    steps,
  })
}
