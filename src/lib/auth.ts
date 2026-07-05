import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { rateLimitSync, getClientIP } from "@/lib/rate-limit"

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string
        const password = credentials?.password as string

        if (!email || !password) return null

        // Rate limit by IP: 10 attempts per minute
        const ip = await getClientIP()
        const ipRl = await rateLimitSync(`login:ip:${ip}`, 10, 60_000)
        if (!ipRl.success) return null

        // Rate limit by email: 5 attempts per minute
        const emailRl = await rateLimitSync(`login:email:${email}`, 5, 60_000)
        if (!emailRl.success) return null

        const user = await prisma.user.findUnique({ where: { email } })
        if (!user) return null

        if (user.password) {
          const valid = await bcrypt.compare(password, user.password)
          if (!valid) return null
        }

        return { id: user.id, name: user.name, email: user.email, image: user.image }
      },
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub
      }
      return session
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id
      }
      return token
    },
  },
  pages: {
    signIn: "/login",
  },
})
