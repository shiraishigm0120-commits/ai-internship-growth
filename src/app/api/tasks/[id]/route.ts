import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { handleApiError } from "@/lib/api-utils"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const task = await prisma.task.findUnique({
      where: { id },
      include: { internship: { select: { userId: true } } },
    })
    if (!task || task.internship.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    return NextResponse.json({ data: task })
  } catch (error) {
    return handleApiError(error, "GET /api/tasks/[id]")
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const task = await prisma.task.findUnique({
      where: { id },
      include: { internship: { select: { userId: true } } },
    })
    if (!task || task.internship.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const body = await req.json()
    const updated = await prisma.task.update({
      where: { id },
      data: {
        title: body.title,
        description: body.description,
        status: body.status,
        priority: body.priority,
        dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
        startDate: body.startDate ? new Date(body.startDate) : undefined,
        completedAt: body.status === "completed" ? new Date() : task.completedAt,
        tags: body.tags ? JSON.stringify(body.tags) : undefined,
      },
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    return handleApiError(error, "PUT /api/tasks/[id]")
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const task = await prisma.task.findUnique({
      where: { id },
      include: { internship: { select: { userId: true } } },
    })
    if (!task || task.internship.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    await prisma.task.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, "DELETE /api/tasks/[id]")
  }
}
