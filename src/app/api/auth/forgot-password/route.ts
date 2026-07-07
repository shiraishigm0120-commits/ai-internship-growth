import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { randomBytes } from "crypto"
import { rateLimitSync, getClientIP } from "@/lib/rate-limit"
import { handleApiError } from "@/lib/api-utils"

export async function POST(req: Request) {
  try {
    const ip = await getClientIP()
    const rl = await rateLimitSync(`forgot-password:${ip}`, 3, 300_000)
    if (!rl.success) {
      return NextResponse.json(
        { error: "请求过于频繁，请 5 分钟后再试" },
        { status: 429 }
      )
    }

    const { email } = await req.json()
    if (!email) {
      return NextResponse.json({ error: "请输入邮箱" }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { email } })

    // Always return success to prevent email enumeration
    if (!user) {
      return NextResponse.json({
        message:
          "如果该邮箱已注册，你将收到密码重置链接。",
      })
    }

    const token = randomBytes(32).toString("hex")
    const expires = new Date(Date.now() + 3600_000) // 1 hour

    await prisma.verificationToken.create({
      data: {
        identifier: `reset:${email}`,
        token,
        expires,
      },
    })

    // In production, send email here. For now, return the token directly.
    return NextResponse.json({
      message: "密码重置链接已生成",
      resetToken: token,
      resetUrl: `/reset-password?token=${token}`,
    })
  } catch (error) {
    return handleApiError(error, "POST /api/auth/forgot-password")
  }
}
