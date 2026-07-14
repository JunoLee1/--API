import { api } from './api'
import type { Report, CreateReportDto, UpdateReportDto } from '@/types/report'

function buildForm(data: Record<string, string | File | undefined>): FormData {
  const form = new FormData()
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) form.append(key, value)
  }
  return form
}

export const reportApi = {
  list: () => api.get<Report[]>('/reports'),

  get: (id: number) => api.get<Report>(`/reports/${id}`),

  create: (dto: CreateReportDto) =>
    api.postForm<Report>('/reports', buildForm({ type: dto.type, title: dto.title, content: dto.content, file: dto.file })),

  update: (id: number, dto: UpdateReportDto) =>
    api.patchForm<Report>(`/reports/${id}`, buildForm({ title: dto.title, content: dto.content, file: dto.file })),

  submit: (id: number) => api.post<Report>(`/reports/${id}/submit`),

  approve: (id: number) => api.post<Report>(`/reports/${id}/approve`),

  reject: (id: number, reason: string) => api.post<Report>(`/reports/${id}/reject`, { reason }),
}
