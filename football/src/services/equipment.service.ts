import { api } from './api'
import type {
  EquipmentItem,
  EquipmentUnit,
  EquipmentAssignment,
  CreateEquipmentItemDto,
  EquipmentUnitStatus,
} from '@/types/equipment'

export const equipmentApi = {
  listItems: () => api.get<EquipmentItem[]>('/equipment'),

  getItem: (id: number) => api.get<EquipmentItem>(`/equipment/${id}`),

  createItem: (dto: CreateEquipmentItemDto) =>
    api.post<EquipmentItem>('/equipment', dto),

  updateUnitStatus: (unitId: number, status: EquipmentUnitStatus) =>
    api.patch<EquipmentUnit>(`/equipment/units/${unitId}/status`, { status }),

  listAssignments: (playerId?: string) =>
    api.get<EquipmentAssignment[]>(
      `/equipment/assignments${playerId ? `?playerId=${playerId}` : ''}`,
    ),

  assign: (playerId: string, equipmentItemId: number, equipmentUnitId?: number) =>
    api.post<EquipmentAssignment>('/equipment/assignments', {
      playerId,
      equipmentItemId,
      ...(equipmentUnitId != null && { equipmentUnitId }),
    }),

  returnAssignment: (assignmentId: number) =>
    api.patch<EquipmentAssignment>(`/equipment/assignments/${assignmentId}/return`, {}),
}
