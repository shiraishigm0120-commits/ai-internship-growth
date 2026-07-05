import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getOpenAI } from "@/lib/openai"
import { prisma } from "@/lib/prisma"

// ============================================================
// 工具定义 —— Agent 的"手脚"，也是这节要学的核心
// ============================================================

const TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "list_my_tasks",
      description:
        "查询用户的任务列表。可以按状态筛选：in_progress（进行中）、completed（已完成）、todo（待开始）。不传 status 则返回所有任务。",
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            description: "任务状态筛选：in_progress | completed | todo。可选。",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_daily_records",
      description:
        "查询用户的实习日报记录。返回最近的日报，包含日期、标题、摘要、心情、工作时长。",
      parameters: {
        type: "object",
        properties: {
          days: {
            type: "number",
            description: "查询最近多少天的记录，默认 7 天，最多 30 天。",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_internship_info",
      description:
        "获取用户当前实习的基本信息：公司名称、岗位、部门、入职天数。",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_my_skills",
      description:
        "查询用户掌握的技能列表。返回技能名称、等级(1-10)、分类(professional/tool/soft/domain)、趋势(improving/stable/declining)。",
      parameters: {
        type: "object",
        properties: {
          category: {
            type: "string",
            description: "技能分类筛选：professional | tool | soft | domain。可选。",
          },
        },
        required: [],
      },
    },
  },
]

// ============================================================
// 工具实现
// ============================================================

// 演示数据（未登录时使用）
const DEMO_DATA = {
  tasks: [
    { title: "完成用户访谈纪要", status: "in_progress", priority: "high", dueDate: "2026-07-10" },
    { title: "整理Q2招聘数据", status: "in_progress", priority: "medium", dueDate: "2026-07-08" },
    { title: "更新岗位JD模板", status: "completed", priority: "medium", dueDate: "2026-07-03" },
    { title: "新人入职培训PPT", status: "todo", priority: "low", dueDate: "2026-07-15" },
  ],
  records: [
    { date: "2026-07-04", title: "候选人电话初筛", summary: "筛选了12份简历，电话沟通5位候选人", mood: "productive", hoursWorked: 8 },
    { date: "2026-07-03", title: "面试安排与协调", summary: "协调3场技术面，整理了面试评估表", mood: "busy", hoursWorked: 9 },
    { date: "2026-07-02", title: "JD优化讨论会", summary: "和业务部门对齐了新岗位的JD要求", mood: "good", hoursWorked: 7 },
  ],
  internship: { companyName: "某某科技", position: "HR实习生", department: "人力资源部", startDate: "2026-06-15" },
}

async function executeTool(
  name: string,
  args: Record<string, any>,
  userId: string | null
): Promise<string> {
  const isReal = !!userId

  switch (name) {
    case "list_my_tasks": {
      if (!isReal) {
        const status = args.status as string | undefined
        const tasks = status
          ? DEMO_DATA.tasks.filter((t) => t.status === status)
          : DEMO_DATA.tasks
        if (tasks.length === 0) return "暂无任务"
        return tasks
          .map(
            (t, i) =>
              `${i + 1}. [${t.status}] ${t.title} | 优先级: ${t.priority} | 截止: ${t.dueDate}`
          )
          .join("\n")
      }
      const status = args.status as string | undefined
      const where: any = {
        internship: { userId },
        ...(status ? { status } : {}),
      }
      const tasks = await prisma.task.findMany({
        where,
        select: { title: true, status: true, priority: true, dueDate: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      })
      if (tasks.length === 0) return "暂无任务"
      return tasks
        .map(
          (t, i) =>
            `${i + 1}. [${t.status}] ${t.title} | 优先级: ${t.priority}${t.dueDate ? ` | 截止: ${t.dueDate.toISOString().slice(0, 10)}` : ""}`
        )
        .join("\n")
    }

    case "get_daily_records": {
      if (!isReal) {
        const days = Math.min(args.days ?? 7, 30)
        const records = DEMO_DATA.records.filter((r) => {
          const d = new Date(r.date)
          const cutoff = new Date()
          cutoff.setDate(cutoff.getDate() - days)
          return d >= cutoff
        })
        if (records.length === 0) return "暂无日报记录"
        return records
          .map(
            (r) =>
              `📅 ${r.date} | ${r.title} | 心情: ${r.mood} | 工时: ${r.hoursWorked}h | 摘要: ${r.summary}`
          )
          .join("\n")
      }
      const days = Math.min(args.days ?? 7, 30)
      const since = new Date()
      since.setDate(since.getDate() - days)

      const records = await prisma.dailyRecord.findMany({
        where: {
          internship: { userId },
          date: { gte: since },
        },
        select: { date: true, title: true, summary: true, mood: true, hoursWorked: true },
        orderBy: { date: "desc" },
        take: 30,
      })
      if (records.length === 0) return "暂无日报记录"
      return records
        .map(
          (r) =>
            `📅 ${r.date.toISOString().slice(0, 10)} | ${r.title ?? "无标题"} | 心情: ${r.mood ?? "未记录"} | 工时: ${r.hoursWorked ?? "未记录"}h | 摘要: ${r.summary ?? "无"}`
        )
        .join("\n")
    }

    case "get_internship_info": {
      if (!isReal) {
        const i = DEMO_DATA.internship
        const dayDiff = Math.floor(
          (Date.now() - new Date(i.startDate).getTime()) / (1000 * 60 * 60 * 24)
        )
        return `公司: ${i.companyName} | 岗位: ${i.position} | 部门: ${i.department} | 已实习 ${dayDiff + 1} 天`
      }
      const internship = await prisma.internship.findFirst({
        where: { userId, isActive: true },
        select: { companyName: true, position: true, department: true, startDate: true },
      })
      if (!internship) return "暂无活跃实习"
      const dayDiff = Math.floor(
        (Date.now() - internship.startDate.getTime()) / (1000 * 60 * 60 * 24)
      )
      return `公司: ${internship.companyName} | 岗位: ${internship.position} | 部门: ${internship.department ?? "未填写"} | 已实习 ${dayDiff + 1} 天`
    }

    case "list_my_skills": {
      if (!isReal) {
        // 演示数据
        return "1. 简历筛选 | 等级: 6/10 | 分类: professional | 趋势: improving\n2. 面试沟通 | 等级: 5/10 | 分类: soft | 趋势: improving\n3. Excel数据分析 | 等级: 7/10 | 分类: tool | 趋势: stable"
      }
      const category = args.category as string | undefined
      const skills = await prisma.skill.findMany({
        where: { userId, ...(category ? { category } : {}) },
        select: { name: true, level: true, category: true, trend: true },
        orderBy: { level: "desc" },
      })
      if (skills.length === 0) return "暂无技能记录"
      return skills
        .map((s) => `${s.name} | 等级: ${s.level}/10 | 分类: ${s.category} | 趋势: ${s.trend}`)
        .join("\n")
    }

    default:
      return `未知工具: ${name}`
  }
}

// ============================================================
// Agent 循环
// ============================================================

export async function POST(req: Request) {
  const session = await auth()
  const userId = session?.user?.id ?? null

  const { message } = await req.json()
  if (!message) {
    return NextResponse.json({ error: "message 不能为空" }, { status: 400 })
  }

  const openai = getOpenAI()
  const model = process.env.OPENAI_MODEL || "gpt-4o"

  const messages: any[] = [
    {
      role: "system",
      content:
        userId
          ? "你是一个实习助手 AI。你可以使用工具查询用户的实习数据。用中文回答，语气友好。回答时引用工具返回的具体数据。"
          : "你是一个实习助手 AI（演示模式）。你可以使用工具查询演示数据。用中文回答，语气友好。回答时提及你查到的具体任务和日报内容。",
    },
    { role: "user", content: message },
  ]

  const steps: string[] = []

  for (let i = 0; i < 5; i++) {
    steps.push(`🔄 第 ${i + 1} 轮：发送请求给 LLM…`)

    const response = await openai.chat.completions.create({
      model,
      messages,
      tools: TOOLS,
      tool_choice: "auto",
    })

    const msg = response.choices[0]!.message

    // 情况 1：LLM 想调工具
    if (msg.tool_calls && msg.tool_calls.length > 0) {
      for (const tc of msg.tool_calls) {
        const toolName = tc.function.name
        const rawArgs = tc.function.arguments
        const args = JSON.parse(rawArgs)

        steps.push(`  🔧 调用工具：${toolName}(${rawArgs})`)

        const result = await executeTool(toolName, args, userId)
        steps.push(`  📦 返回 ${result.length} 个字符`)

        messages.push({
          role: "assistant",
          content: "",
          tool_calls: [{ id: tc.id, type: "function", function: { name: toolName, arguments: rawArgs } }],
        })
        messages.push({ role: "tool", content: result, tool_call_id: tc.id })
      }
      continue
    }

    // 情况 2：LLM 直接回答
    steps.push(`  💬 回答（${msg.content?.length ?? 0} 字）`)
    return NextResponse.json({
      demo: !userId,
      answer: msg.content ?? "（无回答）",
      steps,
      toolCallsMade: i,
    })
  }

  return NextResponse.json({
    answer: "Agent 循环次数过多，请简化问题。",
    steps,
  })
}
