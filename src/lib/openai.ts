import OpenAI from "openai"
import { prisma } from "@/lib/prisma"
import { decrypt } from "@/lib/crypto"

const clientCache = new Map<string, OpenAI>()

function getBaseURL(): string | undefined {
  const url = process.env.OPENAI_BASE_URL
  if (!url) return undefined
  // Normalize: strip trailing slash, append /v1 if not present
  const normalized = url.replace(/\/+$/, "")
  if (normalized.endsWith("/v1")) return normalized
  return `${normalized}/v1`
}

export function getOpenAI(apiKey?: string | null) {
  const key = apiKey || process.env.OPENAI_API_KEY || "demo-key"
  const baseURL = getBaseURL()
  const cacheKey = `${key.slice(-8)}:${baseURL ?? "default"}`

  if (!clientCache.has(cacheKey)) {
    clientCache.set(cacheKey, new OpenAI({ apiKey: key, baseURL }))
  }
  return clientCache.get(cacheKey)!
}

export async function resolveUserAI(userId: string) {
  const settings = await prisma.userSettings.findUnique({
    where: { userId },
    select: { openaiApiKey: true, aiModel: true },
  })

  const userKey = settings?.openaiApiKey ? decrypt(settings.openaiApiKey) : null
  const model = settings?.aiModel || process.env.OPENAI_MODEL || "gpt-4o"

  if (userKey) {
    return { client: getOpenAI(userKey), model, isReal: true }
  }

  return { client: getOpenAI(), model, isReal: false }
}
