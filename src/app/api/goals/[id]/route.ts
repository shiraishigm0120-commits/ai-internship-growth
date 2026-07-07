import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { handleApiError, badRequest, notFound, success } from "@/lib/api-utils"

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const goal = await prisma.goal.findUnique({ where: { id } })

    if (!goal || goal.userId !== session.user.id) {
      return notFound("目标不存在")
    }

    const body = await req.json()
    const { title, description, category, targetValue, currentValue, unit, deadline, status } = body

    const validCategories = ["skill", "project", "habit", "career"]
    const validStatuses = ["active", "completed", "abandoned"]

    const updateData: Record<string, unknown> = {}
    if (title !== undefined) updateData.title = title.trim()
    if (description !== undefined) updateData.description = description?.trim() || null
    if (category !== undefined && validCategories.includes(category)) updateData.category = category
    if (targetValue !== undefined && typeof targetValue === "number") updateData.targetValue = targetValue
    if (currentValue !== undefined && typeof currentValue === "number") {
      const maxVal = targetValue !== undefined ? targetValue : goal.targetValue
      updateData.currentValue = Math.max(0, Math.min(currentValue, maxVal))
    }
    if (unit !== undefined) updateData.unit = unit.trim()
    if (deadline !== undefined) updateData.deadline = deadline ? new Date(deadline) : null
    if (status !== undefined && validStatuses.includes(status)) updateData.status = status

    const updated = await prisma.goal.update({
      where: { id },
      data: updateData,
    })

    return success(updated)
  } catch (error) {
    return handleApiError(error, `PUT /api/goals/${id}`)
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const goal = await prisma.goal.findUnique({ where: { id } })

    if (!goal || goal.userId !== session.user.id) {
      return notFound("目标不存在")
    }

    await prisma.goal.delete({ where: { id } })

    return success({ deleted: true })
  } catch (error) {
    return handleApiError(error, `DELETE /api/goals/${id}`)
  }
}
