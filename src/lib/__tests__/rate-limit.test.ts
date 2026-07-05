import { describe, it, expect, beforeEach, vi } from "vitest"
import { rateLimit } from "@/lib/rate-limit"

describe("rateLimit", () => {
  beforeEach(() => {
    // Clear internal state between tests
  })

  it("首次请求应该成功", () => {
    const result = rateLimit("test-user", 5, 60_000)
    expect(result.success).toBe(true)
    expect(result.remaining).toBe(4)
  })

  it("超出限制的请求应该被拒绝", () => {
    const key = `test-reject-${Date.now()}`
    // 使用所有配额: 5 requests, window 60s
    for (let i = 0; i < 5; i++) {
      const r = rateLimit(key, 5, 60_000)
      expect(r.success).toBe(true)
    }
    // 第6次应该被拒绝
    const result = rateLimit(key, 5, 60_000)
    expect(result.success).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it("不同的 key 应该有独立的限额", () => {
    const key1 = `user-a-${Date.now()}`
    const key2 = `user-b-${Date.now()}`

    // 用完 key1
    for (let i = 0; i < 5; i++) rateLimit(key1, 5, 60_000)
    expect(rateLimit(key1, 5, 60_000).success).toBe(false)

    // key2 仍然应该成功
    expect(rateLimit(key2, 5, 60_000).success).toBe(true)
  })
})
