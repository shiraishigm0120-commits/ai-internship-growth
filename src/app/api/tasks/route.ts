import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const internshipId = searchParams.get("internshipId")
  const status = searchParams.get("status")
  const priority = searchParams.get("priority")
  const search = searchParams.get("search")

  if (!internshipId) {
    const internship = await prisma.internship.findFirst({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    })
    if (!internship) return NextResponse.json({ data: [] })
    return NextResponse.redirect(
      new URL(`/api/tasks?internshipId=${internship.id}`, req.url)
    )
  }

  const tasks = await prisma.task.findMany({
    where: {
      internshipId,
      internship: { userId: session.user.id },
      ...(status && status !== "all" ? { status } : {}),
      ...(priority && priority !== "all" ? { priority } : {}),
      ...(search ? { title: { contains: search } } : {}),
    },
    orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
  })

  return NextResponse.json({ data: tasks })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { internshipId, title, description, priority, status, dueDate, startDate, tags } = body

  const internship = await prisma.internship.findUnique({
    where: { id: internshipId },
    select: { userId: true },
  })
  if (!internship || internship.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const task = await prisma.task.create({
    data: {
      internshipId,
      title,
      description,
      priority: priority ?? "medium",
      status: status ?? "in_progress",
      dueDate: dueDate ? new Date(dueDate) : null,
      startDate: startDate ? new Date(startDate) : null,
      tags: tags ? JSON.stringify(tags) : "[]",
    },
  })

  return NextResponse.json({ data: task }, { status: 201 })
}
