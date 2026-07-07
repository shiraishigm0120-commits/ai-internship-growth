import OpenAI from "openai"

const RESUME_SYSTEM_PROMPT = `你是一位专业的简历顾问，擅长将实习经历转化为简历上的亮点描述。

用户会提供 STAR 案例（情境、任务、行动、结果）和目标岗位。请根据以下要求生成简历素材：

1. **项目经历子弹点**：每个 STAR 案例生成 1-2 条简历 bullet point，使用强有力的动词开头（如：主导、设计、优化、搭建），包含量化结果。
2. **技能模块**：从案例中提取与目标岗位相关的技能，整理为技能标签列表。
3. **个人总结**：生成一段 2-3 句的实习总结，突出核心能力和主要贡献。

输出格式为严格的 JSON：
{
  "bullets": [
    { "title": "案例标题", "content": "子弹点描述" }
  ],
  "skills": ["技能1", "技能2"],
  "summary": "个人总结文本"
}

要求：
- 所有内容使用中文
- 子弹点控制在一行内，避免过长
- 突出量化结果（如效率提升XX%、完成XX个项目）
- 使用专业但不浮夸的语言`

export async function generateResumeMaterials(
  starCases: Array<{
    title: string
    situation: string
    task: string
    action: string
    result: string
    skills: string[]
  }>,
  targetRole: string,
  openai?: OpenAI,
  model?: string
): Promise<{
  bullets: Array<{ title: string; content: string }>
  skills: string[]
  summary: string
}> {
  if (!openai) {
    return getFallbackResumeMaterials(starCases)
  }

  const caseDescriptions = starCases
    .map(
      (c, i) =>
        `案例${i + 1}：${c.title}\n情境：${c.situation}\n任务：${c.task}\n行动：${c.action}\n结果：${c.result}`
    )
    .join("\n\n")

  try {
    const response = await openai.chat.completions.create({
      model: model ?? (process.env.AI_MODEL || process.env.OPENAI_MODEL) ?? "gpt-4o",
      temperature: 0.7,
      messages: [
        { role: "system", content: RESUME_SYSTEM_PROMPT },
        {
          role: "user",
          content: `目标岗位：${targetRole}\n\nSTAR 案例：\n${caseDescriptions}`,
        },
      ],
    })

    const text = response.choices[0]?.message?.content ?? ""
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return getFallbackResumeMaterials(starCases)

    const parsed = JSON.parse(jsonMatch[0])
    return {
      bullets: parsed.bullets ?? [],
      skills: parsed.skills ?? [],
      summary: parsed.summary ?? "",
    }
  } catch (error) {
    console.error("OpenAI resume generation failed, using fallback:", error)
    return getFallbackResumeMaterials(starCases)
  }
}

function getFallbackResumeMaterials(
  starCases: Array<{ title: string; action: string; result: string; skills: string[] }>
) {
  const bullets = starCases.map((c) => ({
    title: c.title,
    content: `• ${c.action}，${c.result}`,
  }))

  const allSkills = starCases.flatMap((c) => c.skills)
  const uniqueSkills = [...new Set(allSkills)]

  return {
    bullets,
    skills: uniqueSkills,
    summary: "",
  }
}
