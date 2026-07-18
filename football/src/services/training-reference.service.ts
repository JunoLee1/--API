import { api } from '@/services/api'
import type { TrainingReference, TrainingReferenceRecommendation, ReferenceSource } from '@/types/training-reference'
import type { SessionType } from '@/types/training'

export const trainingReferenceApi = {
  list: (params?: { sessionType?: SessionType; tag?: string }) => {
    const qs = new URLSearchParams()
    if (params?.sessionType) qs.set('sessionType', params.sessionType)
    if (params?.tag) qs.set('tag', params.tag)
    const q = qs.toString()
    return api.get<TrainingReference[]>(`/training-references${q ? `?${q}` : ''}`)
  },

  create: (payload: {
    sessionType: SessionType
    title: string
    url: string
    source: ReferenceSource
    tags: string[]
  }) => api.post<TrainingReference>('/training-references', payload),

  delete: (id: number) => api.delete<void>(`/training-references/${id}`),

  getRecommendations: (sessionType: SessionType) =>
    api.get<TrainingReferenceRecommendation[]>(
      `/training-references/recommendations?sessionType=${sessionType}`,
    ),
}
