type LogLevel = "info" | "warn" | "error" | "debug"

interface LogEntry {
  level: LogLevel
  message: string
  timestamp: string
  data?: Record<string, unknown>
}

function formatLog(entry: LogEntry): string {
  if (process.env.NODE_ENV === "production") {
    return JSON.stringify(entry)
  }
  const emoji = { info: "ℹ️", warn: "⚠️", error: "❌", debug: "🔍" }[entry.level]
  const dataStr = entry.data ? ` ${JSON.stringify(entry.data)}` : ""
  return `${emoji} [${entry.timestamp}] ${entry.message}${dataStr}`
}

function log(level: LogLevel, message: string, data?: Record<string, unknown>) {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    data,
  }
  const formatted = formatLog(entry)
  if (level === "error") console.error(formatted)
  else if (level === "warn") console.warn(formatted)
  else console.log(formatted)
}

export const logger = {
  info: (message: string, data?: Record<string, unknown>) => log("info", message, data),
  warn: (message: string, data?: Record<string, unknown>) => log("warn", message, data),
  error: (message: string, data?: Record<string, unknown>) => log("error", message, data),
  debug: (message: string, data?: Record<string, unknown>) => log("debug", message, data),

  ai: {
    request: (model: string) => logger.info("AI request started", { model }),
    response: (model: string, tokens?: number, ms?: number) =>
      logger.info("AI response received", { model, tokens, latencyMs: ms }),
    error: (model: string, error: string) => logger.error("AI request failed", { model, error }),
  },
}
