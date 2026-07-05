import { headers } from "next/headers"
import { prisma } from "@/lib/prisma"

interface RateLimitResult {
  success: boolean
  remaining: number
  reset: number
}

// In-memory cache as first line of defense (fast, catches hot bursts)
const memCache = new Map<string, { count: number; resetAt: number }>()

// Clean up stale memory entries periodically
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of memCache) {
    if (entry.resetAt <= now) memCache.delete(key)
  }
}, 60_000).unref()

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  const resetAt = now + windowMs

  // 1. Check memory cache
  const memEntry = memCache.get(key)
  if (memEntry && memEntry.resetAt > now) {
    if (memEntry.count >= limit) {
      return { success: false, remaining: 0, reset: memEntry.resetAt }
    }
    memEntry.count++
    return { success: true, remaining: limit - memEntry.count, reset: memEntry.resetAt }
  }

  // 2. Track in memory optimistically (non-blocking)
  memCache.set(key, { count: 1, resetAt })

  // 3. Persist to DB asynchronously — the memory cache guards against bursts
  // within this instance; the DB guards against cross-instance abuse
  prisma.rateLimit
    .upsert({
      where: { key },
      create: { key, count: 1, resetAt: new Date(resetAt) },
      update: { count: { increment: 1 } },
    })
    .then((entry) => {
      // Sync memory with actual DB count
      if (entry.count > (memCache.get(key)?.count ?? 0)) {
        memCache.set(key, {
          count: entry.count,
          resetAt: new Date(entry.resetAt).getTime(),
        })
      }
    })
    .catch(() => {
      // DB write failed, memory cache still works for this instance
    })

  return { success: true, remaining: limit - 1, reset: resetAt }
}

export async function rateLimitSync(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const now = Date.now()
  const resetAt = new Date(now + windowMs)

  try {
    // Clean up expired entries for this key
    await prisma.rateLimit.deleteMany({
      where: { key, resetAt: { lte: new Date() } },
    })

    const entry = await prisma.rateLimit.upsert({
      where: { key },
      create: { key, count: 1, resetAt },
      update: {},
    })

    // If entry exists and hasn't expired, increment
    if (new Date(entry.resetAt).getTime() > now) {
      if (entry.count >= limit) {
        return {
          success: false,
          remaining: 0,
          reset: new Date(entry.resetAt).getTime(),
        }
      }
      await prisma.rateLimit.update({
        where: { key },
        data: { count: { increment: 1 } },
      })
      const newCount = entry.count + 1
      return {
        success: true,
        remaining: limit - newCount,
        reset: new Date(entry.resetAt).getTime(),
      }
    }

    // Entry expired, reset
    await prisma.rateLimit.update({
      where: { key },
      data: { count: 1, resetAt },
    })
    return { success: true, remaining: limit - 1, reset: resetAt.getTime() }
  } catch {
    // DB unreachable — fall back to memory-only
    return rateLimit(key, limit, windowMs)
  }
}

export async function getClientIP(): Promise<string> {
  const h = await headers()
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    "127.0.0.1"
  )
}

export function rateLimitHeaders(result: RateLimitResult) {
  return {
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(result.reset),
    "Retry-After": String(Math.ceil((result.reset - Date.now()) / 1000)),
  }
}
