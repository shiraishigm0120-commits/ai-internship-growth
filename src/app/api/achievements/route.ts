import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { handleApiError } from "@/lib/api-utils"

export async function GET(req: Request) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const category = searchParams.get("category")

    const records = await prisma.dailyRecord.findMany({
      where: { internship: { userId: session.user.id } },
      select: { id: true },
    })
    const recordIds = records.map((r) => r.id)

    const achievements = await prisma.achievement.findMany({
      where: {
        recordId: { in: recordIds },
        ...(category && category !== "all" ? { category } : {}),
      },
      include: {
        record: { select: { date: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ data: achievements })
  } catch (error) {
    return handleApiError(error, "GET /api/achievements")
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { recordId, title, description, category, icon, value, unit } = body

    const record = await prisma.dailyRecord.findUnique({
      where: { id: recordId },
      include: { internship: { select: { userId: true } } },
    })
    if (!record || record.internship.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const achievement = await prisma.achievement.create({
      data: {
        recordId,
        title,
        description,
        category: category ?? "milestone",
        icon,
        value,
        unit,
      },
    })

    return NextResponse.json({ data: achievement }, { status: 201 })
  } catch (error) {
    return handleApiError(error, "POST /api/achievements")
  }
}
