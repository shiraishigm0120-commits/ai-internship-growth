import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { handleApiError } from "@/lib/api-utils"

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const achievement = await prisma.achievement.findUnique({
      where: { id },
      include: { record: { include: { internship: { select: { userId: true } } } } },
    })
    if (!achievement || achievement.record.internship.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const body = await req.json()
    const updated = await prisma.achievement.update({
      where: { id },
      data: {
        title: body.title,
        description: body.description,
        category: body.category,
        icon: body.icon,
        value: body.value,
        unit: body.unit,
      },
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    return handleApiError(error, "PUT /api/achievements/[id]")
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
    const achievement = await prisma.achievement.findUnique({
      where: { id },
      include: { record: { include: { internship: { select: { userId: true } } } } },
    })
    if (!achievement || achievement.record.internship.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    await prisma.achievement.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, "DELETE /api/achievements/[id]")
  }
}
