import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { rateLimitSync, getClientIP } from "@/lib/rate-limit"
import { handleApiError } from "@/lib/api-utils"

export async function POST(req: Request) {
  try {
    const ip = await getClientIP()
    const rl = await rateLimitSync(`reset-password:${ip}`, 5, 300_000)
    if (!rl.success) {
      return NextResponse.json(
        { error: "请求过于频繁，请 5 分钟后再试" },
        { status: 429 }
      )
    }

    const { token, password } = await req.json()
    if (!token || !password) {
      return NextResponse.json(
        { error: "缺少必要参数" },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "密码至少需要 6 个字符" },
        { status: 400 }
      )
    }

    const vt = await prisma.verificationToken.findUnique({
      where: { identifier_token: { identifier: "", token } },
    })

    // Try finding by token (identifier is dynamic)
    const allTokens = await prisma.verificationToken.findMany({
      where: { token },
    })

    const validToken = allTokens.find(
      (t) => t.identifier.startsWith("reset:") && t.expires > new Date()
    )

    if (!validToken) {
      return NextResponse.json(
        { error: "重置链接已过期或无效" },
        { status: 400 }
      )
    }

    const email = validToken.identifier.replace("reset:", "")

    await prisma.user.update({
      where: { email },
      data: { password: await bcrypt.hash(password, 12) },
    })

    // Clean up used tokens
    await prisma.verificationToken.deleteMany({
      where: { identifier: { startsWith: "reset:" } },
    })

    return NextResponse.json({ message: "密码已重置，请登录" })
  } catch (error) {
    return handleApiError(error, "POST /api/auth/reset-password")
  }
}
