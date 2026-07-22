import { api } from './api'
import type { IncidentReport, CreateIncidentReportPayload } from '@/types/incident-report'

export const incidentReportApi = {
  getAll: (params?: { teamId?: number; status?: string }) =>
    api.get<IncidentReport[]>('/incident-reports', { params }).then(r => r.data),

  getById: (id: number) =>
    api.get<IncidentReport>(`/incident-reports/${id}`).then(r => r.data),

  create: (payload: CreateIncidentReportPayload) =>
    api.post<IncidentReport>('/incident-reports', payload).then(r => r.data),

  submit: (id: number) =>
    api.patch<IncidentReport>(`/incident-reports/${id}/submit`).then(r => r.data),

  sign: (id: number, role: 'SUPERVISOR' | 'MEDICAL') =>
    api.patch<IncidentReport>(`/incident-reports/${id}/sign`, { role }).then(r => r.data),
}
