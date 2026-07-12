import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { handleApiError } from "@/lib/api-utils"
import { generateDailyReport } from "@/lib/recruitment-report"
import { beijingYmd } from "@/lib/workdays"

export async function GET(req: Request) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const dateParam = searchParams.get("date")
    const dateYmd = dateParam ?? beijingYmd(new Date())

    const internship = await prisma.internship.findFirst({
      where: { userId: session.user.id, isActive: true },
      select: { id: true, userId: true },
    })
    if (!internship) {
      return NextResponse.json({ error: "No active internship" }, { status: 404 })
    }

    const user = await prisma.user.findUnique({
      where: { id: internship.userId },
      select: { name: true },
    })

    const report = await generateDailyReport(internship.id, dateYmd, user?.name ?? "实习生")

    return NextResponse.json({ data: report })
  } catch (error) {
    return handleApiError(error, "GET /api/reports/daily-recruitment")
  }
}
