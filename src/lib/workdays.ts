// Day bucketing for the growth counters (记录天数 / 连续天数 / 实习第 X 天).
// All dates are resolved to Beijing (Asia/Shanghai) calendar days, and only
// workdays (Mon–Fri) count — the intern does not work weekends, so weekends
// never add to a total and never break a streak (Fri → Mon stays unbroken).

export function beijingYmd(d: Date): string {
  return new Date(d).toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" })
}

// Weekday (0=Sun..6=Sat) of a YYYY-MM-DD calendar date, timezone-independent.
export function ymdWeekday(ymd: string): number {
  const [y, m, day] = ymd.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, day)).getUTCDay()
}

export function isWorkday(ymd: string): boolean {
  const wd = ymdWeekday(ymd)
  return wd !== 0 && wd !== 6
}

export function prevYmd(ymd: string): string {
  const [y, m, day] = ymd.split("-").map(Number)
  const d = new Date(Date.UTC(y, m - 1, day) - 86400000)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`
}

// Beijing workdays that have data, unioned from any number of date lists
// (e.g. daily reflections + recruitment funnel entries).
export function workdaySet(...dateLists: Date[][]): Set<string> {
  const days = new Set<string>()
  for (const list of dateLists) {
    for (const d of list) {
      const ymd = beijingYmd(d)
      if (isWorkday(ymd)) days.add(ymd)
    }
  }
  return days
}

// Consecutive workdays with data ending at the most recent workday on/before
// today (Beijing). Weekends are skipped rather than breaking the streak.
export function currentStreak(days: Set<string>): number {
  let streak = 0
  let cursor = beijingYmd(new Date())
  while (!isWorkday(cursor)) cursor = prevYmd(cursor)
  while (days.has(cursor)) {
    streak++
    cursor = prevYmd(cursor)
    while (!isWorkday(cursor)) cursor = prevYmd(cursor)
  }
  return streak
}

// Number of workdays from the internship start through today, inclusive.
export function workdaysElapsed(startDate: Date): number {
  const start = beijingYmd(startDate)
  const today = beijingYmd(new Date())
  if (today < start) return 0
  let count = 0
  let cursor = today
  while (cursor >= start) {
    if (isWorkday(cursor)) count++
    cursor = prevYmd(cursor)
  }
  return count
}
