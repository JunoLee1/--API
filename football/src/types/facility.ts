export type FacilityZone = 'GROUND' | 'MECHANICAL' | 'STRUCTURAL' | 'SAFETY' | 'SANITATION' | 'OPERATIONS'
export type InspectionType = 'DAILY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL'
export type InspectionResult = 'OK' | 'ISSUE_FOUND'
export type MaintenancePriority = 'EMERGENCY' | 'HIGH' | 'NORMAL'
export type MaintenanceStatus = 'OPEN' | 'IN_PROGRESS' | 'PENDING_APPROVAL' | 'APPROVED' | 'RESOLVED' | 'REJECTED'

export interface FacilityInspection {
  id: number
  type: InspectionType
  facilityZone: FacilityZone
  result: InspectionResult
  isStatutory: boolean
  certificateUrl: string | null
  statutoryDeadline: string | null
  inspectedAt: string
  notes: string | null
  inspectedBy: { id: number; username: string }
  createdAt: string
}

export interface MaintenanceRequest {
  id: number
  title: string
  description: string
  priority: MaintenancePriority
  status: MaintenanceStatus
  estimatedCost: number | null
  actualCost: number | null
  postIncidentReport: string | null
  sourceInspection: { id: number; type: InspectionType; facilityZone: FacilityZone } | null
  createdBy: { id: number; username: string }
  approvedBy: { id: number; username: string } | null
  approvedAt: string | null
  gmApprovedBy: { id: number; username: string } | null
  gmApprovedAt: string | null
  rejectionReason: string | null
  createdAt: string
  resolvedAt: string | null
}

export interface CreateInspectionDto {
  type: InspectionType
  facilityZone: FacilityZone   // matches backend field name (not "zone")
  result: InspectionResult
  isStatutory?: boolean
  inspectedAt?: string
  notes?: string
}

export interface CreateMaintenanceDto {
  title: string
  description: string
  priority: MaintenancePriority
  estimatedCost?: number
}

export interface UpdateMaintenanceDto {
  status?: MaintenanceStatus
  postIncidentReport?: string
  actualCost?: number
}

export const ZONE_LABEL: Record<FacilityZone, string> = {
  GROUND: '경기장',
  MECHANICAL: '기계실',
  STRUCTURAL: '구조물',
  SAFETY: '안전시설',
  SANITATION: '위생',
  OPERATIONS: '운영시설',
}

export const INSPECTION_TYPE_LABEL: Record<InspectionType, string> = {
  DAILY: '일일',
  MONTHLY: '월간',
  QUARTERLY: '분기',
  ANNUAL: '연간',
}

export const RESULT_LABEL: Record<InspectionResult, string> = {
  OK: '정상',
  ISSUE_FOUND: '이상 발견',
}

export const RESULT_STYLE: Record<InspectionResult, string> = {
  OK: 'bg-green-100 text-green-800 border-green-200',
  ISSUE_FOUND: 'bg-red-100 text-red-800 border-red-200',
}

export const PRIORITY_LABEL: Record<MaintenancePriority, string> = {
  EMERGENCY: '긴급',
  HIGH: '높음',
  NORMAL: '일반',
}

export const PRIORITY_STYLE: Record<MaintenancePriority, string> = {
  EMERGENCY: 'bg-red-100 text-red-800 border-red-200',
  HIGH: 'bg-orange-100 text-orange-800 border-orange-200',
  NORMAL: 'bg-gray-100 text-gray-600 border-gray-200',
}

export const STATUS_LABEL: Record<MaintenanceStatus, string> = {
  OPEN: '접수',
  IN_PROGRESS: '처리중',
  PENDING_APPROVAL: 'FM 결재 대기',
  APPROVED: 'GM 결재 대기',
  RESOLVED: '완료',
  REJECTED: '반려',
}

export const STATUS_STYLE: Record<MaintenanceStatus, string> = {
  OPEN: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  IN_PROGRESS: 'bg-blue-100 text-blue-800 border-blue-200',
  PENDING_APPROVAL: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  APPROVED: 'bg-violet-100 text-violet-800 border-violet-200',
  RESOLVED: 'bg-green-100 text-green-800 border-green-200',
  REJECTED: 'bg-red-100 text-red-800 border-red-200',
}
