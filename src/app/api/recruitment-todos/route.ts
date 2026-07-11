import { NextResponse, after } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { handleApiError } from "@/lib/api-utils"
import { pullCandidatesFromFeishu } from "@/lib/feishu"
import { getTodayTodos } from "@/lib/recruitment-todos"

// Throttle Feishu pulls: at most one per internship per TTL window.
const lastPull = new Map<string, number>()
const PULL_TTL_MS = 30_000

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const internship = await prisma.internship.findFirst({
      where: { userId: session.user.id, isActive: true },
      select: { id: true },
    })
    if (!internship) {
      return NextResponse.json({ data: { date: "", items: [] } })
    }

    // Candidate board (Feishu) is source of truth: refresh before deriving (throttled).
    const now = Date.now()
    if ((lastPull.get(internship.id) ?? 0) < now - PULL_TTL_MS) {
      lastPull.set(internship.id, now)
      after(() => pullCandidatesFromFeishu(internship.id))
    }

    const data = await getTodayTodos(internship.id)
    return NextResponse.json({ data })
  } catch (error) {
    return handleApiError(error, "GET /api/recruitment-todos")
  }
}
