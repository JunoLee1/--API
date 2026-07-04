import { api } from './api'

export interface NotificationItem {
  id: string
  type: string
  title: string
  body: string
  readAt: string | null
  createdAt: string
}

export const notificationApi = {
  my: () => api.get<NotificationItem[]>('/notifications/my'),
  markRead: (id: string) => api.post<void>(`/notifications/${id}/read`, {}),
}
