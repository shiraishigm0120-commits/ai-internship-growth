import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const internships = await prisma.internship.findMany({
    where: { userId: session.user.id },
    orderBy: { startDate: "desc" },
  })

  return NextResponse.json({ data: internships })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const {
    companyName,
    position,
    department,
    startDate,
    endDate,
    description,
  } = await req.json()

  if (!companyName || !position || !startDate) {
    return NextResponse.json(
      { error: "companyName, position, and startDate are required" },
      { status: 400 }
    )
  }

  const internship = await prisma.internship.create({
    data: {
      userId: session.user.id,
      companyName,
      position,
      department,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
      description,
    },
  })

  return NextResponse.json({ data: internship })
}
