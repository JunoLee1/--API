import { api } from './api'
import type { PlanReport } from '@/types/plan-report'

export const planReportApi = {
  list: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return api.get<PlanReport[]>(`/plan-reports${qs}`)
  },

  get: (id: number) =>
    api.get<PlanReport>(`/plan-reports/${id}`),

  create: (data: object) =>
    api.post<PlanReport>('/plan-reports', data),

  update: (id: number, data: object) =>
    api.put<PlanReport>(`/plan-reports/${id}`, data),

  submit: (id: number) =>
    api.post<PlanReport>(`/plan-reports/${id}/submit`),

  approve: (id: number) =>
    api.post<PlanReport>(`/plan-reports/${id}/approve`),

  reject: (id: number, reason: string) =>
    api.post<PlanReport>(`/plan-reports/${id}/reject`, { reason }),

  submitResult: (id: number, resultContent: string) =>
    api.post<PlanReport>(`/plan-reports/${id}/result`, { resultContent }),

  uploadFile: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.postForm<{ url: string }>('/plan-reports/upload', form).then(r => r.url)
  },
}
