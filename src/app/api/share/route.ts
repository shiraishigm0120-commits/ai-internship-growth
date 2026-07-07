import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { randomBytes } from "crypto"
import { handleApiError } from "@/lib/api-utils"

// POST — create a share link
export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { type } = await req.json()

    const token = randomBytes(16).toString("hex")

    await prisma.shareLink.create({
      data: {
        userId: session.user.id,
        token,
        type: type ?? "timeline",
        expiresAt: new Date(Date.now() + 7 * 24 * 3600_000), // 7 days
      },
    })

    const shareUrl = `${process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/share/${token}`

    return NextResponse.json({ data: { token, url: shareUrl } })
  } catch (error) {
    return handleApiError(error, "POST /api/share")
  }
}
