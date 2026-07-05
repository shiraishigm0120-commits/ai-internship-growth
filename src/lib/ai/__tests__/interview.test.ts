import { describe, it, expect } from "vitest"
import { buildInterviewContext, buildInitialGreeting } from "@/lib/ai/interview"

describe("buildInterviewContext", () => {
  it("生成包含公司名称的上下文", () => {
    const result = buildInterviewContext({
      userName: "小明",
      companyName: "腾讯",
      position: "产品经理实习生",
      internshipDay: 30,
    })

    expect(result).toContain("小明")
    expect(result).toContain("腾讯")
    expect(result).toContain("产品经理实习生")
    expect(result).toContain("30")
  })

  it("包含部门信息当提供时", () => {
    const result = buildInterviewContext({
      userName: "小明",
      companyName: "腾讯",
      position: "产品经理实习生",
      department: "用户增长部",
      internshipDay: 30,
    })

    expect(result).toContain("用户增长部")
  })

  it("包含近期记录摘要", () => {
    const result = buildInterviewContext({
      userName: "小明",
      companyName: "腾讯",
      position: "产品经理",
      internshipDay: 30,
      recentRecords: [
        { date: "2026-06-27", title: "优化登录流程", summary: "完成了登录流程的优化" },
      ],
    })

    expect(result).toContain("登录流程")
  })

  it("包含进行中的任务", () => {
    const result = buildInterviewContext({
      userName: "小明",
      companyName: "腾讯",
      position: "产品经理",
      internshipDay: 30,
      activeTasks: [{ title: "完成需求文档", status: "in_progress" }],
    })

    expect(result).toContain("需求文档")
  })
})

describe("buildInitialGreeting", () => {
  it("返回时间相关的问候语", () => {
    const greeting = buildInitialGreeting({ userName: "小明" })
    expect(greeting).toBeTruthy()
    expect(typeof greeting).toBe("string")
  })
})
