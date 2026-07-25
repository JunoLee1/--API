import { api } from './api'
import type { CoachingStaffMember } from '@/types/coaching-staff'

function getWeekRange(): { weekStart: string; weekEnd: string } {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + diff)
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  return {
    weekStart: monday.toISOString().slice(0, 10),
    weekEnd: sunday.toISOString().slice(0, 10),
  }
}

export const coachingStaffApi = {
  list: (week?: string) => {
    const params = week
      ? `?week=${week}`
      : (() => { const { weekStart } = getWeekRange(); return `?week=${weekStart}` })()
    return api.get<CoachingStaffMember[]>(`/coaching-staff${params}`)
  },
}
