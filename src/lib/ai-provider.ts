import OpenAI from "openai"
import { prisma } from "@/lib/prisma"
import { decrypt } from "@/lib/crypto"

const clientCache = new Map<string, OpenAI>()

// Support legacy env var names for backward compatibility
const env = (key: string) =>
  process.env[`AI_${key}`] ?? process.env[`OPENAI_${key}`]

function getBaseURL(): string | undefined {
  const url = env("BASE_URL")
  if (!url) return undefined
  const normalized = url.replace(/\/+$/, "")
  if (normalized.endsWith("/v1")) return normalized
  return `${normalized}/v1`
}

export function createAIClient(apiKey?: string | null) {
  const key = apiKey || env("API_KEY") || "demo-key"
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
    select: { encryptedApiKey: true, aiModel: true },
  })

  const userKey = (() => {
    if (!settings?.encryptedApiKey) return null
    try {
      return decrypt(settings.encryptedApiKey)
    } catch (e) {
      console.error("Failed to decrypt user API key, falling back:", e)
      return null
    }
  })()

  const model = settings?.aiModel || env("MODEL") || "deepseek-v4-pro"

  // Personal DB key > env key > demo mode
  const effectiveKey = userKey || env("API_KEY")

  if (effectiveKey) {
    return { client: createAIClient(effectiveKey), model, isReal: true }
  }

  return { client: createAIClient(), model, isReal: false }
}

// Legacy re-exports
export { createAIClient as getOpenAI }
