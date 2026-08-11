import { api } from './api'
import type { PlanReport } from '@/types/plan-report'

export const planReportApi = {
  list: (params?: { templateType?: string; departmentId?: number; status?: string }) => {
    const q = new URLSearchParams()
    if (params?.templateType) q.set('templateType', params.templateType)
    if (params?.departmentId) q.set('departmentId', String(params.departmentId))
    if (params?.status) q.set('status', params.status)
    const qs = q.toString()
    return api.get<PlanReport[]>(`/plan-reports${qs ? `?${qs}` : ''}`)
  },

  get: (id: number) =>
    api.get<PlanReport>(`/plan-reports/${id}`),

  create: (data: object) =>
    api.post<PlanReport>('/plan-reports', data),

  update: (id: number, data: object) =>
    api.patch<PlanReport>(`/plan-reports/${id}`, data),

  submit: (id: number) =>
    api.post<PlanReport>(`/plan-reports/${id}/submit`, {}),

  approve: (id: number) =>
    api.post<PlanReport>(`/plan-reports/${id}/approve`, {}),

  reject: (id: number, reason: string) =>
    api.post<PlanReport>(`/plan-reports/${id}/reject`, { reason }),

  submitResult: (id: number, resultContent: string) =>
    api.post<PlanReport>(`/plan-reports/${id}/result`, { resultContent }),

  uploadFile: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.postForm<{ url: string }>('/plan-reports/upload', form)
  },
}
