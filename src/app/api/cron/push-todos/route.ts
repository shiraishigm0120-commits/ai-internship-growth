import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { pullCandidatesFromFeishu, syncTodosToFeishu, beijingMidnightMs } from "@/lib/feishu"
import { getTodayTodos } from "@/lib/recruitment-todos"
import { handleApiError } from "@/lib/api-utils"

// Daily cron (see vercel.json). Pulls the candidate board fresh, derives today's
// recruiting to-dos, and writes them into the Feishu 今日To-do 表.
export async function GET(req: Request) {
  try {
    // Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is set.
    const secret = process.env.CRON_SECRET
    if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const internships = await prisma.internship.findMany({
      where: { isActive: true },
      select: { id: true },
    })

    const dateMs = beijingMidnightMs(new Date())
    const results: { internshipId: string; items: number; ok: boolean }[] = []
    for (const { id } of internships) {
      try {
        await pullCandidatesFromFeishu(id)
        const { items } = await getTodayTodos(id)
        await syncTodosToFeishu(dateMs, items)
        results.push({ internshipId: id, items: items.length, ok: true })
      } catch {
        results.push({ internshipId: id, items: 0, ok: false })
      }
    }

    return NextResponse.json({ data: { ran: results.length, results } })
  } catch (error) {
    return handleApiError(error, "GET /api/cron/push-todos")
  }
}
