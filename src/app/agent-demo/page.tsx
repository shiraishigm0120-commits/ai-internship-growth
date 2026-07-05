"use client"

import { useState } from "react"

export default function AgentDemoPage() {
  const [message, setMessage] = useState("字节跳动是哪年成立的？")
  const [mode, setMode] = useState<"agent" | "chat">("agent")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{
    mode: string
    answer: string
    steps: string[]
    toolCallsMade: number
  } | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setResult(null)

    const res = await fetch("/api/agent-demo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, mode }),
    })

    const data = await res.json()
    setResult(data)
    setLoading(false)
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Agent Demo</h1>
          <p className="text-zinc-400 mt-1">
            同一个问题，对比「普通模式」和「Agent 模式」的区别
          </p>
        </div>

        {/* 输入区 */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode("agent")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                mode === "agent"
                  ? "bg-emerald-600 text-white"
                  : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Agent 模式（有工具）
            </button>
            <button
              type="button"
              onClick={() => setMode("chat")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                mode === "chat"
                  ? "bg-emerald-600 text-white"
                  : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              普通模式（无工具）
            </button>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-zinc-600"
              placeholder="输入你的问题…"
            />
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-white text-black rounded-lg text-sm font-medium hover:bg-zinc-200 transition disabled:opacity-50"
            >
              {loading ? "请求中…" : "发送"}
            </button>
          </div>
        </form>

        {/* 建议问题 */}
        <div className="flex flex-wrap gap-2">
          {[
            "字节跳动是哪年成立的？",
            "腾讯有多少员工？",
            "阿里做什么业务？",
            "现在几点了？",
            "帮我查一下小米",
          ].map((q) => (
            <button
              key={q}
              onClick={() => setMessage(q)}
              className="px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-md text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition"
            >
              {q}
            </button>
          ))}
        </div>

        {/* 结果区 */}
        {(loading || result) && (
          <div className="space-y-4">
            <hr className="border-zinc-800" />

            {/* 最终回答 */}
            {loading ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 animate-pulse">
                <div className="h-4 bg-zinc-800 rounded w-3/4" />
              </div>
            ) : result ? (
              <div
                className={`bg-zinc-900 border rounded-xl p-6 ${
                  result.mode === "agent"
                    ? "border-emerald-800"
                    : "border-zinc-700"
                }`}
              >
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      result.mode === "agent"
                        ? "bg-emerald-900/50 text-emerald-400"
                        : "bg-zinc-800 text-zinc-400"
                    }`}
                  >
                    {result.mode === "agent" ? "Agent 模式" : "普通模式"}
                  </span>
                  {result.mode === "agent" && (
                    <span className="text-xs text-zinc-500">
                      调用了 {result.toolCallsMade} 次工具
                    </span>
                  )}
                </div>
                <p className="text-sm leading-relaxed">{result.answer}</p>
              </div>
            ) : null}

            {/* Agent 思考过程 */}
            {result && result.steps.length > 0 && (
              <details open className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                <summary className="px-6 py-3 cursor-pointer text-sm font-medium text-zinc-300 hover:text-zinc-100 select-none">
                  Agent 内部思考过程（{result.steps.length} 步）
                </summary>
                <div className="px-6 pb-4 space-y-1">
                  {result.steps.map((step, i) => (
                    <pre
                      key={i}
                      className="text-xs text-zinc-500 font-mono whitespace-pre-wrap"
                    >
                      {step}
                    </pre>
                  ))}
                </div>
              </details>
            )}

            {/* 对比提示 */}
            {result && result.mode === "chat" && (
              <div className="bg-amber-900/20 border border-amber-800 rounded-xl p-4">
                <p className="text-sm text-amber-300">
                  普通模式直接回答，没有调用任何工具。LLM
                  的回答来自训练数据，可能过时或不准确。
                  <br />
                  试试切换到「Agent 模式」再问一次相同问题？
                </p>
              </div>
            )}
            {result && result.mode === "agent" && result.toolCallsMade > 0 && (
              <div className="bg-emerald-900/20 border border-emerald-800 rounded-xl p-4">
                <p className="text-sm text-emerald-300">
                  Agent 模式自动调用了 {result.toolCallsMade}{" "}
                  次工具来获取真实数据。LLM 不是凭记忆回答，而是"动手查"之后才回答。
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
