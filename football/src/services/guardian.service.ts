import { api } from './api'
import type { AcademyFee } from '@/types/academy-fee'

export const guardianApi = {
  getChildren: () =>
    api.get<ChildPlayer[]>('/guardians/me/children'),

  getDashboard: (playerId: string) =>
    api.get<GuardianDashboard>(`/guardians/me/children/${playerId}/dashboard`),

  getAttendance: (playerId: string, params?: { from?: string; to?: string }) => {
    const qs = new URLSearchParams()
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    const q = qs.toString()
    return api.get<AttendanceRecord[]>(`/guardians/me/children/${playerId}/attendance${q ? `?${q}` : ''}`)
  },

  getInjuries: (playerId: string) =>
    api.get<InjuryWithReport[]>(`/guardians/me/children/${playerId}/injuries`),

  getFees: (playerId: string) =>
    api.get<AcademyFee[]>(`/guardians/me/children/${playerId}/fees`),

  submitFeeProof: (playerId: string, feeId: number, url: string) =>
    api.patch<AcademyFee>(`/guardians/me/children/${playerId}/fees/${feeId}/submit-proof`, { url }),

  getGrowthReports: (playerId: string) =>
    api.get<GrowthEvaluation[]>(`/growth-reports/player/${playerId}`),

  linkByCode: (code: string) =>
    api.post<void>('/guardians/link/code', { code }),

  issueInviteCode: (playerId: string) =>
    api.post<{ code: string; expiresAt: string }>('/guardians/invite-code', { playerId }),
}

export interface GrowthEvaluation {
  id: number
  year: number
  month: number
  attitude: number
  fundamentals: number
  spatialAwareness: number
  physical: number
  comment: string | null
  publishedAt: string | null
  coachName: string
}

export interface ChildPlayer {
  id: string
  playerName: string
  position: string
  level: string
  teamId: number | null
  team: { name: string } | null
}

export interface GuardianDashboard {
  child: ChildPlayer
  suspension: { reason: 'FEE_LOCK' | 'SAFEGUARD' | null }
  upcoming: { matches: unknown[]; sessions: unknown[] }
  attendance: { total: number; attended: number; absent: number; late: number }
  growth: { latestEvaluation: unknown | null; activeDevelopmentPlan: unknown | null }
  injuries: { active: unknown[]; history: unknown[] }
  stats: { lastMatch: unknown | null }
  fees: { pending: AcademyFee[]; overdue: AcademyFee[] }
}

export interface AttendanceRecord {
  id: number
  attendance: string | null
  playerId: string
  sessionId: number
  session: { id: number; date: string; sessionType: string; goal: string | null }
  player: { id: string; playerName: string; position: string }
}

export interface InjuryWithReport {
  id: number
  bodyPart: string
  cause: string
  status: string
  occurredAt: string
  expectedReturnDate: string | null
  playerId: string
  hospitalType: string | null
  customHospitalName: string | null
  partner: { id: number; name: string } | null
  report: unknown | null
}
