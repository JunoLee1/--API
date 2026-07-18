export interface CoachAvailability {
  id: number
  userId: number
  startDate: string
  endDate: string
  reason: string | null
  createdById: number
  createdAt: string
  user: { id: number; nickname: string | null; coachingRole: string | null }
}

export interface CreateCoachAvailabilityPayload {
  userId: number
  startDate: string
  endDate: string
  reason?: string
}
