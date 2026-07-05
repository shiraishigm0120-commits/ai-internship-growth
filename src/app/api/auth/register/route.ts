import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { rateLimitSync, rateLimitHeaders, getClientIP } from "@/lib/rate-limit"

const registerSchema = z.object({
  email: z.string().email("请输入有效的邮箱"),
  password: z.string().min(6, "密码至少 6 位"),
  name: z.string().min(1, "请输入姓名"),
})

// 5 registrations per hour per IP
const IP_HARD_LIMIT = 5
// 3 attempts per email per minute (prevent rapid probing)
const EMAIL_TRY_LIMIT = 3

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const parsed = registerSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "参数错误" },
        { status: 400 }
      )
    }

    const { email, password, name } = parsed.data

    // IP-based rate limit: 5 registrations per hour
    const ip = await getClientIP()
    const ipRl = await rateLimitSync(`register:ip:${ip}`, IP_HARD_LIMIT, 3600_000)
    if (!ipRl.success) {
      return NextResponse.json(
        { error: "注册过于频繁，请稍后再试" },
        { status: 429, headers: rateLimitHeaders(ipRl) }
      )
    }

    // Email-based rate limit: 3 attempts per minute per email
    const emailRl = await rateLimitSync(`register:email:${email}`, EMAIL_TRY_LIMIT, 60_000)
    if (!emailRl.success) {
      return NextResponse.json(
        { error: "该邮箱操作过于频繁，请稍后再试" },
        { status: 429, headers: rateLimitHeaders(emailRl) }
      )
    }

    // Check if user already exists
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json(
        { error: "该邮箱已注册" },
        { status: 409 }
      )
    }

    // Hash password and create user
    const hashedPassword = await bcrypt.hash(password, 12)

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
      },
    })

    return NextResponse.json(
      { data: { id: user.id, email: user.email, name: user.name } },
      { status: 201 }
    )
  } catch (error) {
    console.error("Registration error:", error)
    return NextResponse.json(
      { error: "注册失败，请稍后重试" },
      { status: 500 }
    )
  }
}
