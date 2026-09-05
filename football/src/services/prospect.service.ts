import { api } from './api'
import type {
  Prospect, CreateProspectDto, UpdateProspectDto, ProspectStatus, SignProspectDto,
  ProspectVideoEvaluation, ProspectEvaluationLog,
  CreateVideoEvaluationDto, CreateEvaluationLogDto, AcquisitionGateCheckResult,
} from '@/types/prospect'

export const prospectApi = {
  list: (status?: ProspectStatus) =>
    api.get<Prospect[]>(`/prospects${status ? `?status=${status}` : ''}`),

  get: (id: number) => api.get<Prospect>(`/prospects/${id}`),

  create: (dto: CreateProspectDto) => api.post<Prospect>('/prospects', dto),

  update: (id: number, dto: UpdateProspectDto) =>
    api.patch<Prospect>(`/prospects/${id}`, dto),

  transition: (id: number, status: ProspectStatus) =>
    api.patch<Prospect>(`/prospects/${id}/status`, { status }),

  sign: (id: number, dto: SignProspectDto) =>
    api.post<Prospect>(`/prospects/${id}/sign`, dto),

  checkDuplicate: (name: string, currentTeam?: string) => {
    const params = new URLSearchParams({ name })
    if (currentTeam) params.set('currentTeam', currentTeam)
    return api.get<{
      prospects: { id: number; name: string; currentTeam: string | null; position: string | null; status: string }[]
      squadPlayers: { id: string; playerName: string; position: string | null; status: string }[]
    }>(`/prospects/check-duplicate?${params}`)
  },

  videoEvaluations: {
    list: (id: number) =>
      api.get<ProspectVideoEvaluation[]>(`/prospects/${id}/video-evaluations`),
    create: (id: number, dto: CreateVideoEvaluationDto) =>
      api.post<ProspectVideoEvaluation>(`/prospects/${id}/video-evaluations`, dto),
  },

  evaluationLogs: {
    list: (id: number) =>
      api.get<ProspectEvaluationLog[]>(`/prospects/${id}/evaluation-logs`),
    create: (id: number, dto: CreateEvaluationLogDto) =>
      api.post<ProspectEvaluationLog>(`/prospects/${id}/evaluation-logs`, dto),
  },

  acquisitionGateCheck: (id: number) =>
    api.get<AcquisitionGateCheckResult>(`/prospects/${id}/acquisition-gate-check`),
}
