import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { encrypt } from "@/lib/crypto"
import { handleApiError } from "@/lib/api-utils"

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const [user, settings] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, name: true, email: true, image: true, university: true, major: true },
      }),
      prisma.userSettings.findUnique({
        where: { userId: session.user.id },
        select: {
          encryptedApiKey: true,
          aiModel: true,
          resumeTargetRole: true,
          industryFocus: true,
          notificationEnabled: true,
        },
      }),
    ])

    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json({
      data: {
        ...user,
        encryptedApiKey: settings?.encryptedApiKey ? "••••••••" : null,
        hasApiKey: !!settings?.encryptedApiKey,
        resumeTargetRole: settings?.resumeTargetRole ?? "",
        industryFocus: settings?.industryFocus ?? "",
        notificationEnabled: settings?.notificationEnabled ?? true,
      },
    })
  } catch (error) {
    return handleApiError(error, "GET /api/user/profile")
  }
}

export async function PUT(req: Request) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { name, university, major, encryptedApiKey, resumeTargetRole, industryFocus, notificationEnabled } = await req.json()

    const hasSettingsUpdate = encryptedApiKey !== undefined || resumeTargetRole !== undefined || industryFocus !== undefined || notificationEnabled !== undefined

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
      hasSettingsUpdate
        ? prisma.userSettings.upsert({
            where: { userId: session.user.id },
            create: {
              userId: session.user.id,
              encryptedApiKey: encryptedApiKey ? encrypt(encryptedApiKey) : null,
              resumeTargetRole: resumeTargetRole ?? null,
              industryFocus: industryFocus ?? null,
              notificationEnabled: notificationEnabled ?? true,
            },
            update: {
              ...(encryptedApiKey !== undefined ? { encryptedApiKey: encryptedApiKey ? encrypt(encryptedApiKey) : null } : {}),
              ...(resumeTargetRole !== undefined ? { resumeTargetRole } : {}),
              ...(industryFocus !== undefined ? { industryFocus } : {}),
              ...(notificationEnabled !== undefined ? { notificationEnabled } : {}),
            },
          })
        : Promise.resolve(),
    ])

    return NextResponse.json({ data: user })
  } catch (error) {
    return handleApiError(error, "PUT /api/user/profile")
  }
}
