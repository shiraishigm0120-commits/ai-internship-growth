import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { resolveUserAI } from "@/lib/ai-provider"
import { INTERVIEW_SYSTEM_PROMPT, buildInterviewContext } from "@/lib/ai/interview"
import { getLatestGrowthMemory } from "@/lib/ai/growth-memory"
import { prisma } from "@/lib/prisma"
import { rateLimit, rateLimitHeaders } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"
import { unauthorized, badRequest, serverError } from "@/lib/api-utils"

function buildDemoResponse(messages: { role: string; content: string }[], isFirstMsg: boolean) {
  const lastMsg = (messages[messages.length - 1]?.content ?? "").toLowerCase()

  let response: string
  if (isFirstMsg || /今天|今日|早上|下午/.test(lastMsg)) {
    response = "听起来今天有在认真工作！能具体说说你今天做了什么任务吗？比如具体负责了什么、用了什么工具？"
  } else if (/做了|完成|做完|处理好|写了|整理|筛选|分析|面试|开会|汇报|PPT|Excel|文档|报告/.test(lastMsg)) {
    response = "很好！在这个过程中，你具体是怎么做的？有没有遇到什么挑战，或者学到了什么新东西？"
  } else if (/遇到|困难|问题|不懂|不会|挑战|麻烦|出错|失败/.test(lastMsg)) {
    response = "遇到困难是成长的一部分。你觉得这个困难的根本原因是什么？如果重来一次，你会怎么做？"
  } else if (/学到|学会|知道|了解|掌握|懂了|明白了|收获/.test(lastMsg)) {
    response = "有新收获很棒！这个新学到的东西，你觉得下次能怎么应用到工作中？"
  } else if (/帮助|帮了|协助|帮忙|支持/.test(lastMsg)) {
    response = "很棒，能帮助同事说明你在团队中越来越有价值了。这个过程你自己有什么收获吗？"
  } else if (/数据|数字|指标|提升|下降|增长|减少/.test(lastMsg)) {
    response = "用数据说话是个好习惯！如果把这些数据整理成图表或报告，你觉得会传达出什么信息？"
  } else if (/面试|招聘|简历|筛选|HR|候选人|offer/.test(lastMsg)) {
    response = "招聘相关的工作很有意思。从今天的经历中，你对「什么样的人适合这个岗位」有什么新的理解？"
  } else if (/任务|项目|需求|排期|进度/.test(lastMsg)) {
    response = "项目管理是实习中很宝贵的经验。你的任务优先级是怎么判断的？有没有想过怎么让流程更高效？"
  } else if (/总结|结束|好了|可以了|差不多了|没了|就这样|先这样/.test(lastMsg)) {
    response = "好的！今天的记录很充实。让我帮你整理一下今天的内容。\n\n[SUMMARY_READY]"
  } else {
    const probingQuestions = [
      "有意思！这件事让你印象最深的是什么？",
      "能不能再多说一点？比如具体的细节和你当时的想法？",
      "很好，你在其中扮演的角色是什么？独立完成还是团队协作？",
      "如果让你的 Leader 来评价你这件事，你觉得他会怎么说？",
      "从这件事里，你觉得自己最大的成长是什么？",
      "有没有什么让你觉得意外或者没想到的情况？",
    ]
    response = probingQuestions[Math.floor(Math.random() * probingQuestions.length)]
  }

  if (messages.length >= 6 && !/总结|结束|好了|可以了|差不多了|没了|就这样|先这样/.test(lastMsg)) {
    response += "\n\n（如果你觉得今天的内容记录得差不多了，可以说「总结一下」，我会帮你整理。）"
  }

  return response
}

function streamSSE(content: string): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      const chunks = content.match(/[\s\S]{1,3}/g) ?? [content]
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: chunk })}\n\n`))
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"))
      controller.close()
    },
  })
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session?.user) return unauthorized()

    const rl = rateLimit(`chat:${session.user.id}`, 20, 60_000)
    if (!rl.success) {
      return NextResponse.json(
        { error: "请求过于频繁，请稍后再试" },
        { status: 429, headers: rateLimitHeaders(rl) }
      )
    }

    const { messages, internshipId } = await req.json()

    if (!messages || !Array.isArray(messages)) {
      return badRequest("Messages required")
    }

    // Load internship context (non-critical, ignore failures)
    let contextStr = ""
    if (internshipId) {
      try {
        const internship = await prisma.internship.findUnique({
          where: { id: internshipId },
          include: {
            dailyRecords: {
              orderBy: { date: "desc" },
              take: 5,
              select: { date: true, title: true, summary: true },
            },
            tasks: {
              where: { status: "in_progress" },
              select: { title: true, status: true },
            },
          },
        })

        if (internship) {
          const startDate = new Date(internship.startDate)
          const dayDiff = Math.floor(
            (Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24)
          )

          const growthMemory = await getLatestGrowthMemory(session.user.id)

          contextStr = buildInterviewContext({
            userName: session.user.name ?? undefined,
            companyName: internship.companyName,
            position: internship.position,
            department: internship.department ?? undefined,
            internshipDay: dayDiff + 1,
            recentRecords: internship.dailyRecords.map((r) => ({
              date: r.date.toISOString(),
              title: r.title ?? undefined,
              summary: r.summary ?? undefined,
            })),
            activeTasks: internship.tasks.map((t) => ({
              title: t.title,
              status: t.status,
            })),
            growthMemory: growthMemory
              ? {
                  summary: growthMemory.summary,
                  skills: growthMemory.skills,
                  openChallenges: growthMemory.openChallenges,
                  keyLearnings: growthMemory.keyLearnings,
                  careerCapital: growthMemory.careerCapital,
                }
              : undefined,
          })
        }
      } catch (e) {
        console.error("Failed to load interview context:", e)
      }
    }

    const { client: openai, model, isReal } = await resolveUserAI(session.user.id)

    const isFirstMsg = messages.filter((m: { role: string }) => m.role === "user").length <= 1

    // Try real AI if available
    if (isReal) {
      try {
        const systemPrompt = INTERVIEW_SYSTEM_PROMPT + (contextStr ? `\n\n## 实习生背景信息\n${contextStr}` : "")
        const aiMessages = [
          { role: "system" as const, content: systemPrompt },
          ...messages.slice(-20).map((m: { role: string; content: string }) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
        ]

        logger.ai.request(model)
        const startTime = Date.now()

        const aiResponse = await openai.chat.completions.create({
          model,
          messages: aiMessages,
          stream: true,
          temperature: 0.8,
          max_tokens: 500,
        })

        const encoder = new TextEncoder()
        const stream = new ReadableStream({
          async start(controller) {
            let fullContent = ""
            try {
              for await (const chunk of aiResponse) {
                const content = chunk.choices[0]?.delta?.content ?? ""
                if (content) {
                  fullContent += content
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ content })}\n\n`)
                  )
                }
              }
              controller.enqueue(encoder.encode("data: [DONE]\n\n"))
              controller.close()
              logger.ai.response(model, undefined, Date.now() - startTime)
            } catch (e) {
              logger.error("Chat stream error", { error: String(e) })
              controller.close()
            }
          },
        })

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        })
      } catch (error) {
        logger.ai.error(model, String(error))
        console.error("AI API failed, falling back to demo mode:", String(error).slice(0, 200))
        // Fall through to demo mode
      }
    }

    // Demo mode (or fallback when real AI fails)
    const demoPrefix = !isReal
      ? "💡 当前为**演示模式**（未配置 API Key）。去 个人 → 个人设置 中添加你的 Key 即可解锁真实 AI 教练。\n\n---\n\n"
      : "⚠️ AI 服务暂时不可用，已切换为演示模式。请检查 API Key 是否正确。\n\n---\n\n"

    const demoResponse = buildDemoResponse(messages, isFirstMsg)
    return streamSSE(demoPrefix + demoResponse)

  } catch (error) {
    return serverError(error)
  }
}
