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

  useEffect(() => {
    fetch("/api/internships")
      .then((res) => res.json())
      .then((json) => {
        const active = json.data?.find((i: Internship) => i.isActive)
        if (active) setInternship(active)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return { internship, loading }
}
