"use client"

import { useEffect } from "react"
import { AlertTriangle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Global error:", error)
  }, [error])

  return (
    <html>
      <body>
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="text-center max-w-sm">
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-lg font-semibold mb-2">系统错误</h2>
            <p className="text-sm text-muted-foreground mb-6">
              抱歉，应用遇到了一个意外错误。请尝试刷新页面。
            </p>
            <Button onClick={reset} size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              刷新页面
            </Button>
          </div>
        </div>
      </body>
    </html>
  )
}
