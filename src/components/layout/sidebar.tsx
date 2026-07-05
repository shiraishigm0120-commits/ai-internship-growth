"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useSession, signOut } from "next-auth/react"
import { useTheme } from "next-themes"
import {
  Sun,
  Moon,
  Sparkles,
  TrendingUp,
  Briefcase,
  User,
  FileText,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

const navItems = [
  {
    href: "/today",
    label: "今天",
    icon: Sparkles,
    description: "AI 访谈 & 今日成长",
  },
  {
    href: "/timeline",
    label: "成长时间轴",
    icon: TrendingUp,
    description: "里程碑 & 能力变化",
  },
  {
    href: "/assets",
    label: "能力资产",
    icon: Briefcase,
    description: "STAR & 简历 & 知识",
  },
  {
    href: "/reports",
    label: "实习报告",
    icon: FileText,
    description: "生成 & 导出报告",
  },
  {
    href: "/profile",
    label: "个人",
    icon: User,
    description: "实习 & 任务 & 设置",
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const { theme, setTheme } = useTheme()
  const [collapsed, setCollapsed] = useState(false)

  const isActive = (href: string) => {
    return pathname === href || pathname.startsWith(href + "/")
  }

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 64 : 220 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      className="h-screen sticky top-0 flex flex-col bg-sidebar border-r border-sidebar-border z-30"
    >
      {/* Logo */}
      <div
        className={cn(
          "flex items-center h-14 px-4 border-b border-sidebar-border",
          collapsed ? "justify-center" : "justify-between"
        )}
      >
        <Link href="/today" className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-sidebar-primary flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-4 h-4 text-sidebar-primary-foreground" />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                className="font-semibold text-sm text-sidebar-foreground whitespace-nowrap overflow-hidden"
              >
                AI Coach
              </motion.span>
            )}
          </AnimatePresence>
        </Link>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 py-4 px-2 space-y-1">
        {navItems.map((item) => {
          const active = isActive(item.href)
          return (
            <Tooltip key={item.href}>
              <TooltipTrigger>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150 relative",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium shadow-sm"
                      : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50",
                    collapsed && "justify-center px-0"
                  )}
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  {!collapsed && (
                    <div className="truncate">
                      <div className="text-sm leading-none">{item.label}</div>
                      <div className="text-[10px] text-sidebar-foreground/40 mt-0.5 leading-none">
                        {item.description}
                      </div>
                    </div>
                  )}
                  {active && (
                    <motion.div
                      layoutId="active-tab-pill"
                      className="absolute left-1.5 top-1/2 -translate-y-1/2 w-0.5 h-6 rounded-full bg-sidebar-primary"
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  )}
                </Link>
              </TooltipTrigger>
              {collapsed && (
                <TooltipContent side="right" className="text-xs">
                  {item.label} — {item.description}
                </TooltipContent>
              )}
            </Tooltip>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className="border-t border-sidebar-border p-2 space-y-1">
        {/* Theme Toggle */}
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className={cn(
            "flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-sidebar-foreground/55 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-all",
            collapsed && "justify-center px-0"
          )}
        >
          {theme === "dark" ? (
            <Sun className="w-4.5 h-4.5 flex-shrink-0" />
          ) : (
            <Moon className="w-4.5 h-4.5 flex-shrink-0" />
          )}
          {!collapsed && <span>切换主题</span>}
        </button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger>
            <button
              className={cn(
                "flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-all",
                collapsed && "justify-center px-0"
              )}
            >
              <Avatar className="w-6 h-6 flex-shrink-0">
                <AvatarImage src={session?.user?.image ?? ""} />
                <AvatarFallback className="text-[10px] bg-sidebar-accent text-sidebar-accent-foreground">
                  {session?.user?.name?.slice(0, 2) ?? "U"}
                </AvatarFallback>
              </Avatar>
              {!collapsed && (
                <span className="truncate text-xs">
                  {session?.user?.name ?? "用户"}
                </span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="end" className="w-48">
            <Link href="/profile">
              <DropdownMenuItem>
                <User className="w-4 h-4 mr-2" />
                个人资料
              </DropdownMenuItem>
            </Link>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => signOut()}>
              <LogOut className="w-4 h-4 mr-2" />
              退出登录
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Collapse Toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "flex items-center gap-3 w-full px-3 py-1.5 rounded-lg text-xs text-sidebar-foreground/35 hover:text-sidebar-foreground/60 transition-all",
            collapsed && "justify-center px-0"
          )}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4" />
              <span>收起菜单</span>
            </>
          )}
        </button>
      </div>
    </motion.aside>
  )
}
