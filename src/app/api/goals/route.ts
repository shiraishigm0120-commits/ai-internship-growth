import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { handleApiError, badRequest, created, success } from "@/lib/api-utils"

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const goals = await prisma.goal.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    })

    return success(goals)
  } catch (error) {
    return handleApiError(error, "GET /api/goals")
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { title, description, category, targetValue, unit, deadline } = body

    if (!title || typeof title !== "string" || !title.trim()) {
      return badRequest("目标标题不能为空")
    }

    const validCategories = ["skill", "project", "habit", "career"]
    const categoryValue = validCategories.includes(category) ? category : "skill"

    const goal = await prisma.goal.create({
      data: {
        userId: session.user.id,
        title: title.trim(),
        description: description?.trim() || null,
        category: categoryValue,
        targetValue: typeof targetValue === "number" ? targetValue : 100,
        currentValue: 0,
        unit: unit?.trim() || "%",
        deadline: deadline ? new Date(deadline) : null,
      },
    })

    return created(goal)
  } catch (error) {
    return handleApiError(error, "POST /api/goals")
  }
}
