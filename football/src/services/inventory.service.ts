import { api } from './api'

export interface InventoryItem {
  id: number
  name: string
  unit: string
  quantity: number
  minThreshold: number
  createdAt: string
  updatedAt: string
}

export interface CreateInventoryItemDto {
  name: string
  unit: string
  quantity?: number
  minThreshold?: number
}

export const inventoryApi = {
  list: () => api.get<InventoryItem[]>('/inventory'),
  create: (dto: CreateInventoryItemDto) => api.post<InventoryItem>('/inventory', dto),
  adjust: (id: number, delta: number) => api.patch<InventoryItem>(`/inventory/${id}/quantity`, { delta }),
  alerts: () => api.get<InventoryItem[]>('/inventory/alerts'),
}
