import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { resolveUserAI } from "@/lib/ai-provider"
import { generateResumeMaterials } from "@/lib/ai/resume"
import { handleApiError } from "@/lib/api-utils"

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const internships = await prisma.internship.findMany({
      where: { userId: session.user.id },
      select: { id: true },
    })

    const materials = await prisma.resumeMaterial.findMany({
      where: { internshipId: { in: internships.map((i) => i.id) } },
      orderBy: [{ isPinned: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
    })

    return NextResponse.json({ data: materials })
  } catch (error) {
    return handleApiError(error, "GET /api/resume-materials")
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { targetRole } = await req.json()

    const internship = await prisma.internship.findFirst({
      where: { userId: session.user.id, isActive: true },
      orderBy: { startDate: "desc" },
    })

    if (!internship) {
      return NextResponse.json(
        { error: "No active internship found" },
        { status: 400 }
      )
    }

    // Get verified STAR cases
    const starCases = await prisma.sTARCase.findMany({
      where: { internshipId: internship.id, isVerified: true },
      take: 10,
    })

    if (starCases.length === 0) {
      return NextResponse.json(
        { error: "No verified STAR cases found. Complete daily records first." },
        { status: 400 }
      )
    }

    const caseData = starCases.map((sc) => {
      let skills: string[] = []
      try { skills = JSON.parse(sc.skills) } catch { /* corrupt data */ }
      return {
        title: sc.title,
        situation: sc.situation,
        task: sc.task,
        action: sc.action,
        result: sc.result,
        skills,
      }
    })

    // Generate with AI (or fallback)
    const { client: openai, model } = await resolveUserAI(session.user.id)
    const generated = await generateResumeMaterials(caseData, targetRole ?? "通用岗位", openai, model)

    // Atomically replace old materials with new ones
    await prisma.$transaction(async (tx) => {
      // Delete old AI-generated materials
      await tx.resumeMaterial.deleteMany({
        where: { internshipId: internship.id, isAiGenerated: true },
      })

      // Save bullet points
      let sortOrder = 0
      for (const bullet of generated.bullets) {
        await tx.resumeMaterial.create({
          data: {
            internshipId: internship.id,
            category: "bullet",
            title: bullet.title,
            content: bullet.content,
            targetRole: targetRole ?? undefined,
            isAiGenerated: true,
            sortOrder: sortOrder++,
          },
        })
      }

      // Save skill block
      if (generated.skills.length > 0) {
        await tx.resumeMaterial.create({
          data: {
            internshipId: internship.id,
            category: "skill_block",
            title: "专业技能",
            content: `技能：${generated.skills.join("、")}`,
            targetRole: targetRole ?? undefined,
            isAiGenerated: true,
            sortOrder: sortOrder++,
          },
        })
      }

      // Save summary
      if (generated.summary) {
        await tx.resumeMaterial.create({
          data: {
            internshipId: internship.id,
            category: "summary",
            title: "个人总结",
            content: generated.summary,
            targetRole: targetRole ?? undefined,
            isAiGenerated: true,
            sortOrder: sortOrder++,
          },
        })
      }
    })

    // Return all materials
    const materials = await prisma.resumeMaterial.findMany({
      where: { internshipId: internship.id },
      orderBy: [{ isPinned: "desc" }, { sortOrder: "asc" }],
    })

    return NextResponse.json({ data: materials })
  } catch (error) {
    return handleApiError(error, "POST /api/resume-materials")
  }
}
