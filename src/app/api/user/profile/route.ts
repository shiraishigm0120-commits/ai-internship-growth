import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { encrypt } from "@/lib/crypto"

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [user, settings] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, name: true, email: true, image: true, university: true, major: true },
    }),
    prisma.userSettings.findUnique({
      where: { userId: session.user.id },
      select: { openaiApiKey: true, aiModel: true },
    }),
  ])

  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({
    data: {
      ...user,
      openaiApiKey: settings?.openaiApiKey ? "••••••••" : null,
      hasApiKey: !!settings?.openaiApiKey,
    },
  })
}

export async function PUT(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { name, university, major, openaiApiKey } = await req.json()

  const [user] = await Promise.all([
    prisma.user.update({
      where: { id: session.user.id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(university !== undefined ? { university } : {}),
        ...(major !== undefined ? { major } : {}),
      },
      select: { id: true, name: true, email: true, university: true, major: true },
    }),
    // Upsert UserSettings (encrypt API key before storing)
    openaiApiKey !== undefined
      ? prisma.userSettings.upsert({
          where: { userId: session.user.id },
          create: { userId: session.user.id, openaiApiKey: openaiApiKey ? encrypt(openaiApiKey) : null },
          update: { openaiApiKey: openaiApiKey ? encrypt(openaiApiKey) : null },
        })
      : Promise.resolve(),
  ])

  return NextResponse.json({ data: user })
}
