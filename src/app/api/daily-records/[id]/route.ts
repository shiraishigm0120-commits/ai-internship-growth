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
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    const record = await prisma.dailyRecord.findUnique({
      where: { id },
      include: {
        workItems: true,
        knowledgeItems: true,
        achievements: true,
        internship: {
          select: { userId: true },
        },
      },
    })

    if (!record || record.internship.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    return NextResponse.json({ data: record })
  } catch (error) {
    return handleApiError(error, "GET /api/daily-records/[id]")
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    // Verify ownership before deletion
    const record = await prisma.dailyRecord.findUnique({
      where: { id },
      include: { internship: { select: { userId: true } } },
    })

    if (!record || record.internship.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    await prisma.dailyRecord.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, "DELETE /api/daily-records/[id]")
  }
}
