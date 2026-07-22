export type YouthRegistrationStatus = 'PENDING' | 'GUARDIAN_APPROVED' | 'CONTRACTED' | 'REJECTED'

export interface YouthRegistration {
  id: number
  playerName: string
  birthDate: string
  preferredJerseyNumber: number | null
  teamId: number
  team: { id: number; name: string }
  guardianId: number | null
  guardian: { id: number; username: string; email: string } | null
  status: YouthRegistrationStatus
  requestedById: number
  rejectionReason: string | null
  createdAt: string
}

export interface CreateYouthRegistrationPayload {
  playerName: string
  birthDate: string
  preferredJerseyNumber?: number
  teamId: number
  guardianEmail: string
}
