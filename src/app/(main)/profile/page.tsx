"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { signOut } from "next-auth/react"
import { motion } from "framer-motion"
import {
  User,
  Building2,
  Settings,
  LogOut,
  Plus,
  Trash2,
  CheckCircle,
  Circle,
  Calendar,
  Save,
  Key,
  Eye,
  EyeOff,
} from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

type ProfileTab = "internship" | "tasks" | "settings"

interface InternshipData {
  id: string
  companyName: string
  position: string
  department?: string
  startDate: string
  isActive: boolean
}

interface TaskData {
  id: string
  title: string
  description?: string
  status: string
  priority: string
}

export default function ProfilePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<ProfileTab>("internship")

  // Profile edit
  const [name, setName] = useState("")
  const [university, setUniversity] = useState("")
  const [major, setMajor] = useState("")

  // Internship
  const [internships, setInternships] = useState<InternshipData[]>([])
  const [showNewInternship, setShowNewInternship] = useState(false)
  const [newCompany, setNewCompany] = useState("")
  const [newPosition, setNewPosition] = useState("")
  const [newDepartment, setNewDepartment] = useState("")

  // Tasks
  const [tasks, setTasks] = useState<TaskData[]>([])
  const [newTaskTitle, setNewTaskTitle] = useState("")

  // API Key
  const [apiKey, setApiKey] = useState("")
  const [showApiKey, setShowApiKey] = useState(false)
  const [hasApiKey, setHasApiKey] = useState(false)
  const [savingKey, setSavingKey] = useState(false)

  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
      return
    }
    if (status === "authenticated") {
      loadProfile()
      fetchInternships().then(() => fetchTasks())
    }
  }, [status])

  async function loadProfile() {
    try {
      const res = await fetch("/api/user/profile")
      const json = await res.json()
      if (json.data) {
        setName(json.data.name ?? "")
        setUniversity(json.data.university ?? "")
        setMajor(json.data.major ?? "")
        setHasApiKey(json.data.hasApiKey ?? false)
      }
    } catch {
      // non-critical
    }
  }

  async function fetchInternships() {
    try {
      const res = await fetch("/api/internships")
      const json = await res.json()
      setInternships(json.data ?? [])
    } catch {
      // non-critical
    } finally {
      setLoading(false)
    }
  }

  async function fetchTasks() {
    const active = internships.find((i) => i.isActive)
    if (!active) return
    try {
      const res = await fetch(`/api/tasks?internshipId=${active.id}`)
      const json = await res.json()
      setTasks(json.data ?? [])
    } catch {
      // non-critical
    }
  }

  async function handleSaveProfile() {
    try {
      await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, university, major }),
      })
      toast.success("个人资料已保存")
    } catch {
      toast.error("保存失败")
    }
  }

  async function handleSaveApiKey() {
    if (!apiKey.trim()) return
    setSavingKey(true)
    try {
      await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openaiApiKey: apiKey.trim() }),
      })
      setHasApiKey(true)
      setApiKey("")
      setShowApiKey(false)
      toast.success("API Key 已保存，现在你可以使用真实 AI 了")
    } catch {
      toast.error("保存失败")
    } finally {
      setSavingKey(false)
    }
  }

  async function handleRemoveApiKey() {
    try {
      await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openaiApiKey: null }),
      })
      setHasApiKey(false)
      setApiKey("")
      toast.success("API Key 已移除，已切换至演示模式")
    } catch {
      toast.error("操作失败")
    }
  }

  async function handleCreateInternship() {
    if (!newCompany || !newPosition) return
    try {
      await fetch("/api/internships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: newCompany,
          position: newPosition,
          department: newDepartment || undefined,
          startDate: new Date().toISOString(),
        }),
      })
      setShowNewInternship(false)
      setNewCompany("")
      setNewPosition("")
      setNewDepartment("")
      fetchInternships()
      toast.success("实习档案已创建")
    } catch {
      toast.error("创建失败")
    }
  }

  async function handleCreateTask() {
    if (!newTaskTitle) return
    const internship = internships.find((i) => i.isActive)
    if (!internship) {
      toast.error("请先创建实习档案")
      return
    }
    try {
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          internshipId: internship.id,
          title: newTaskTitle,
        }),
      })
      setNewTaskTitle("")
      fetchTasks()
      toast.success("任务已创建")
    } catch {
      toast.error("创建失败")
    }
  }

  async function handleToggleTask(id: string, currentStatus: string) {
    const newStatus = currentStatus === "completed" ? "in_progress" : "completed"
    try {
      await fetch(`/api/tasks/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      setTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, status: newStatus } : t))
      )
    } catch {
      toast.error("操作失败")
    }
  }

  async function handleDeleteTask(id: string) {
    try {
      await fetch(`/api/tasks/${id}`, { method: "DELETE" })
      setTasks((prev) => prev.filter((t) => t.id !== id))
    } catch {
      toast.error("删除失败")
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-[400px] rounded-2xl" />
      </div>
    )
  }

  const activeInternship = internships.find((i) => i.isActive)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          个人
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {session?.user?.name ?? "用户"} · {session?.user?.email}
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 rounded-xl bg-muted">
        {(
          [
            { key: "internship", label: "实习档案", icon: Building2 },
            { key: "tasks", label: "任务管理", icon: CheckCircle },
            { key: "settings", label: "个人设置", icon: Settings },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Internship Tab */}
      {activeTab === "internship" && (
        <div className="space-y-4">
          {/* Active Internship */}
          {activeInternship && (
            <div className="rounded-xl border bg-card p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">{activeInternship.companyName}</h3>
                  <p className="text-sm text-muted-foreground">
                    {activeInternship.position}
                    {activeInternship.department
                      ? ` · ${activeInternship.department}`
                      : ""}
                  </p>
                </div>
                <span className="ml-auto text-xs px-2 py-1 rounded bg-green-100 dark:bg-green-900/20 text-green-700">
                  进行中
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                <Calendar className="w-3 h-3 inline mr-1" />
                开始于{" "}
                {new Date(activeInternship.startDate).toLocaleDateString(
                  "zh-CN"
                )}
              </p>
            </div>
          )}

          {/* All internships list */}
          {internships
            .filter((i) => !i.isActive)
            .map((i) => (
              <div
                key={i.id}
                className="rounded-xl border bg-card p-4 opacity-60"
              >
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{i.companyName}</span>
                  <span className="text-xs text-muted-foreground">
                    {i.position}
                  </span>
                  <span className="ml-auto text-xs px-1.5 py-0.5 rounded bg-muted">
                    已结束
                  </span>
                </div>
              </div>
            ))}

          {/* Add new internship */}
          {showNewInternship ? (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="rounded-xl border bg-card p-5 space-y-3"
            >
              <h4 className="font-medium text-sm">新建实习档案</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs block mb-1.5 font-medium">公司名称 *</label>
                  <Input
                    value={newCompany}
                    onChange={(e) => setNewCompany(e.target.value)}
                    placeholder="如：腾讯"
                  />
                </div>
                <div>
                  <label className="text-xs block mb-1.5 font-medium">岗位 *</label>
                  <Input
                    value={newPosition}
                    onChange={(e) => setNewPosition(e.target.value)}
                    placeholder="如：产品经理实习生"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs block mb-1.5 font-medium">部门（可选）</label>
                  <Input
                    value={newDepartment}
                    onChange={(e) => setNewDepartment(e.target.value)}
                    placeholder="如：用户增长部"
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowNewInternship(false)}
                >
                  取消
                </Button>
                <Button size="sm" onClick={handleCreateInternship}>
                  创建
                </Button>
              </div>
            </motion.div>
          ) : (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowNewInternship(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              添加实习档案
            </Button>
          )}
        </div>
      )}

      {/* Tasks Tab */}
      {activeTab === "tasks" && (
        <div className="space-y-4">
          {/* New task input */}
          <div className="flex gap-2">
            <Input
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="添加新任务..."
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateTask()
              }}
            />
            <Button size="sm" onClick={handleCreateTask}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          {/* Task groups by status */}
          {["in_progress", "todo", "completed"].map((status) => {
            const groupTasks = tasks.filter((t) => t.status === status)
            if (groupTasks.length === 0) return null
            return (
              <div key={status}>
                <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase">
                  {status === "in_progress"
                    ? "进行中"
                    : status === "todo"
                      ? "待开始"
                      : "已完成"}
                  ({groupTasks.length})
                </h4>
                <div className="space-y-1">
                  {groupTasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center gap-2 p-3 rounded-lg hover:bg-muted/50 transition-colors group"
                    >
                      <button onClick={() => handleToggleTask(task.id, task.status)}>
                        {task.status === "completed" ? (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        ) : (
                          <Circle className="w-5 h-5 text-muted-foreground" />
                        )}
                      </button>
                      <span
                        className={`flex-1 text-sm ${
                          task.status === "completed"
                            ? "line-through text-muted-foreground"
                            : ""
                        }`}
                      >
                        {task.title}
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded ${
                          task.priority === "high"
                            ? "bg-red-100 dark:bg-red-900/20 text-red-700"
                            : task.priority === "medium"
                              ? "bg-amber-100 dark:bg-amber-900/20 text-amber-700"
                              : "bg-muted"
                        }`}
                      >
                        {task.priority === "high"
                          ? "高"
                          : task.priority === "medium"
                            ? "中"
                            : "低"}
                      </span>
                      <button
                        onClick={() => handleDeleteTask(task.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}

          {tasks.length === 0 && (
            <div className="rounded-xl border bg-card p-8 text-center">
              <CheckCircle className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">还没有任务</p>
            </div>
          )}
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === "settings" && (
        <div className="space-y-6">
          {/* Profile */}
          <div className="rounded-xl border bg-card p-5 space-y-3">
            <div className="flex items-center gap-2 mb-3">
              <User className="w-4 h-4" />
              <h3 className="font-medium text-sm">个人资料</h3>
            </div>

            <div>
              <label className="text-xs block mb-1.5 font-medium">姓名</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="你的姓名"
              />
            </div>
            <div>
              <label className="text-xs block mb-1.5 font-medium">学校</label>
              <Input
                value={university}
                onChange={(e) => setUniversity(e.target.value)}
                placeholder="你的学校"
              />
            </div>
            <div>
              <label className="text-xs block mb-1.5 font-medium">专业</label>
              <Input
                value={major}
                onChange={(e) => setMajor(e.target.value)}
                placeholder="你的专业"
              />
            </div>

            <Button size="sm" onClick={handleSaveProfile}>
              <Save className="w-4 h-4 mr-2" />
              保存资料
            </Button>
          </div>

          {/* OpenAI API Key */}
          <div className="rounded-xl border bg-card p-5 space-y-3">
            <div className="flex items-center gap-2 mb-3">
              <Key className="w-4 h-4" />
              <h3 className="font-medium text-sm">OpenAI API Key</h3>
            </div>

            {hasApiKey ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800">
                  <Key className="w-4 h-4 text-green-600" />
                  <span className="text-sm text-green-700 dark:text-green-400">
                    API Key 已配置 — 使用真实 AI
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setHasApiKey(false)
                      setApiKey("")
                    }}
                  >
                    更换 Key
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-500"
                    onClick={handleRemoveApiKey}
                  >
                    移除 Key（切换至演示模式）
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-xs text-muted-foreground mb-3">
                  设置你的 OpenAI API Key 以使用真实 AI。
                  没有 Key 时使用演示模式（不消耗 Token）。
                </p>
              </div>
            )}

            {/* Always show input when adding/replacing */}
            {!hasApiKey && (
              <div className="space-y-3">
                <div className="relative">
                  <Input
                    type={showApiKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-..."
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showApiKey ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <Button
                  size="sm"
                  onClick={handleSaveApiKey}
                  disabled={!apiKey.trim() || savingKey}
                >
                  <Save className="w-4 h-4 mr-2" />
                  {savingKey ? "保存中..." : "保存 Key"}
                </Button>
              </div>
            )}
          </div>

          {/* Logout */}
          <Button
            variant="outline"
            className="w-full text-red-500 hover:text-red-600"
            onClick={() => signOut()}
          >
            <LogOut className="w-4 h-4 mr-2" />
            退出登录
          </Button>
        </div>
      )}
    </div>
  )
}
