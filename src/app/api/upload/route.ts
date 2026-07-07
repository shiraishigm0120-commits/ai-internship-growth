import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { handleApiError } from "@/lib/api-utils"
import { writeFile } from "fs/promises"
import { join } from "path"

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"]
const MAX_SIZE = 2 * 1024 * 1024 // 2MB

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "File type not allowed. Use PNG, JPEG, WebP, or SVG." },
        { status: 400 }
      )
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File too large. Max 2MB." }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const ext = file.type.split("/")[1] === "svg+xml" ? "svg" : file.type.split("/")[1]
    const filename = `logo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const uploadDir = join(process.cwd(), "public", "uploads")

    await writeFile(join(uploadDir, filename), buffer)

    const url = `/uploads/${filename}`
    return NextResponse.json({ data: { url } })
  } catch (error) {
    return handleApiError(error, "POST /api/upload")
  }
}
