import { api } from '@/services/api'
import type {
  TrainingVideo,
  TrainingVideoDetail,
  VideoAssignment,
  CreateVideoPayload,
  CreateAssignmentPayload,
} from '@/types/video'
import type { SessionType } from '@/types/training'

export const videoApi = {
  list: (params?: { sessionType?: SessionType; tag?: string }) => {
    const q = new URLSearchParams()
    if (params?.sessionType) q.set('sessionType', params.sessionType)
    if (params?.tag) q.set('tag', params.tag)
    const qs = q.toString()
    return api.get<TrainingVideo[]>(`/videos${qs ? `?${qs}` : ''}`)
  },

  get: (id: number) => api.get<TrainingVideoDetail>(`/videos/${id}`),

  create: (payload: CreateVideoPayload) =>
    api.post<TrainingVideo>('/videos', payload),

  delete: (id: number) => api.delete<void>(`/videos/${id}`),

  getMyAssignments: () => api.get<VideoAssignment[]>('/videos/my-assignments'),

  createAssignment: (videoId: number, payload: CreateAssignmentPayload) =>
    api.post<VideoAssignment>(`/videos/${videoId}/assignments`, payload),

  updateProgress: (videoId: number, playerId: string, progressRate: number) =>
    api.patch<VideoAssignment>(`/videos/${videoId}/assignments/${playerId}/progress`, { progressRate }),
}
