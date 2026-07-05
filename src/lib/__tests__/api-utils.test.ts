import { describe, it, expect } from "vitest"
import { unauthorized, notFound, badRequest, serverError, success, created } from "@/lib/api-utils"

describe("api-utils", () => {
  it("unauthorized 返回 401", async () => {
    const res = unauthorized()
    const json = await res.json()
    expect(res.status).toBe(401)
    expect(json.error).toBe("Unauthorized")
  })

  it("notFound 返回 404", async () => {
    const res = notFound()
    const json = await res.json()
    expect(res.status).toBe(404)
    expect(json.error).toBe("Not found")
  })

  it("badRequest 返回自定义消息", async () => {
    const res = badRequest("缺少必填字段")
    const json = await res.json()
    expect(res.status).toBe(400)
    expect(json.error).toBe("缺少必填字段")
  })

  it("serverError 返回 500", async () => {
    const res = serverError(new Error("数据库错误"))
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toBe("数据库错误")
  })

  it("success 返回数据和 200", async () => {
    const res = success({ items: [1, 2, 3] })
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toEqual({ items: [1, 2, 3] })
  })

  it("created 返回数据和 201", async () => {
    const res = created({ id: "abc" })
    const json = await res.json()
    expect(res.status).toBe(201)
    expect(json.data).toEqual({ id: "abc" })
  })
})
