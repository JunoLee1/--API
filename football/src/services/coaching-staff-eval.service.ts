import { api } from './api'
import type { CoachingStaffEval } from '@/types/coaching-staff-eval'

export const coachingStaffEvalApi = {
  list: (staffUserId: number) =>
    api.get<CoachingStaffEval[]>(`/coaching-staff/${staffUserId}/evaluations`),

  create: (staffUserId: number, score: number, comment?: string) =>
    api.post<CoachingStaffEval>(`/coaching-staff/${staffUserId}/evaluations`, { score, comment }),
}
