"use client"

import { useState, useEffect } from "react"

type Internship = {
  id: string
  companyName: string
  position: string
  department?: string
  startDate: string
  isActive: boolean
}

export function useActiveInternship() {
  const [internship, setInternship] = useState<Internship | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/internships")
      .then((res) => res.json())
      .then((json) => {
        const active = json.data?.find((i: Internship) => i.isActive)
        if (active) setInternship(active)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "获取实习信息失败")
        console.error(err)
      })
      .finally(() => setLoading(false))
  }, [])

  return { internship, loading, error }
}
