export interface ChatMessage {
  role: "user" | "assistant" | "system"
  content: string
  timestamp: string
}

export interface FunnelExtraction {
  totalApplications?: number
  passedScreening?: number
  passedBusinessReview?: number
  interviewInvited?: number
  interviewAttendees?: number
  offersSent?: number
  offersAccepted?: number
  onboarded?: number
}

export interface FunnelNames {
  screening?: string
  invited?: string
  interviewed?: string
  offer?: string
  inProcess?: string
}

// 复盘中提到的候选人及其今日推进到的阶段（用于自动更新候选人看板）
export interface ExtractedCandidate {
  name: string
  position?: string
  // 今日推进到的阶段：推荐简历/业务筛选/邀约面试/已面试/面试通过/Offer/接受/待入职/已入职/已淘汰
  stageToday: string
  note?: string
}

export interface ExtractedData {
  workItems: {
    type: string
    title: string
    description: string
    status: string
    priority: string
    tags: string[]
    effort?: string
  }[]
  knowledge: {
    category: string
    title: string
    content: string
    source?: string
    tags: string[]
    masteryLevel: string
  }[]
  skills: string[]
  achievements: {
    title: string
    description: string
    category: string
    icon?: string
    value?: number
    unit?: string
  }[]
  summary: string
  mood?: string
  milestoneDetected?: boolean
  milestoneTitle?: string
  milestoneCategory?: string
  skillChanges?: { name: string; from: number; to: number }[]
  reflection?: string
  funnel?: FunnelExtraction
  funnelNames?: FunnelNames
  candidates?: ExtractedCandidate[]
}

export interface DashboardData {
  todayRecorded: boolean
  streakDays: number
  totalDays: number
  currentDay: number
  weeklyTasks: number
  totalTasks: number
  totalKnowledge: number
  totalSTARCases: number
  totalAchievements: number
  skillRadar: { skill: string; level: number }[]
  weeklyActivity: { date: string; count: number }[]
  aiInsight: string
  recentRecords: {
    id: string
    date: string
    title: string
    summary?: string
    mood?: string
  }[]
}

export interface STARCaseData {
  id: string
  title: string
  situation: string
  task: string
  action: string
  result: string
  skills: string[]
  tags: string[]
  impact?: string
  isAiGenerated: boolean
  isVerified: boolean
  starRating: number
  createdAt: string
  workItemId?: string
}

export interface KnowledgeItem {
  id: string
  category: string
  title: string
  content: string
  source?: string
  tags: string[]
  masteryLevel: string
  isBookmarked: boolean
  createdAt: string
}

export interface ResumeMaterialData {
  id: string
  category: string
  title?: string
  content: string
  targetRole?: string
  isAiGenerated: boolean
  isPinned: boolean
}
