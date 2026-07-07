import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { resolveUserAI } from "@/lib/ai-provider"
import { extractDataFromConversation } from "@/lib/ai/extraction"
import { handleApiError } from "@/lib/api-utils"

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { conversation } = await req.json()

    if (!conversation || !Array.isArray(conversation)) {
      return NextResponse.json(
        { error: "conversation required" },
        { status: 400 }
      )
    }

    const { client: openai, model, isReal } = await resolveUserAI(session.user.id)
    if (!isReal) {
      return NextResponse.json({
        extracted: {
          workItems: [],
          knowledge: [],
          achievements: [],
          skills: [],
          summary: "",
        },
      })
    }

    const extracted = await extractDataFromConversation(conversation, openai, model)

    return NextResponse.json({ extracted })
  } catch (error) {
    return handleApiError(error, "POST /api/daily-records/extract")
  }
}
