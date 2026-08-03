import { api } from './api'
import type {
  FacilityInspection,
  MaintenanceRequest,
  CreateInspectionDto,
  CreateMaintenanceDto,
  UpdateMaintenanceDto,
  FacilityZone,
  InspectionType,
  InspectionResult,
  MaintenancePriority,
  MaintenanceStatus,
} from '@/types/facility'

export const facilityApi = {
  inspections: {
    list: (params?: { zone?: FacilityZone; type?: InspectionType; result?: InspectionResult }) => {
      const q = new URLSearchParams()
      if (params?.zone) q.set('zone', params.zone)
      if (params?.type) q.set('type', params.type)
      if (params?.result) q.set('result', params.result)
      const qs = q.toString()
      return api.get<FacilityInspection[]>(`/facility/inspections${qs ? `?${qs}` : ''}`)
    },
    create: (dto: CreateInspectionDto) =>
      api.post<FacilityInspection & { createdMaintenanceId?: number }>('/facility/inspections', dto),
  },
  maintenance: {
    list: (params?: { status?: MaintenanceStatus; priority?: MaintenancePriority }) => {
      const q = new URLSearchParams()
      if (params?.status) q.set('status', params.status)
      if (params?.priority) q.set('priority', params.priority)
      const qs = q.toString()
      return api.get<MaintenanceRequest[]>(`/facility/maintenance${qs ? `?${qs}` : ''}`)
    },
    create: (dto: CreateMaintenanceDto) =>
      api.post<MaintenanceRequest>('/facility/maintenance', dto),
    update: (id: number, dto: UpdateMaintenanceDto) =>
      api.patch<MaintenanceRequest>(`/facility/maintenance/${id}`, dto),
  },
}
