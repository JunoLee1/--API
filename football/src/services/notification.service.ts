import { api } from './api'

export interface NotificationItem {
  id: string
  type: string
  title: string
  body: string
  readAt: string | null
  createdAt: string
}

export const NOTIFICATION_ROUTES: Record<string, string> = {
  // Contracts
  CONTRACT_EXPIRY: '/contracts',
  PERFORMANCE_BONUS_ACHIEVED: '/contracts',
  EXTENSION_OPTION_AVAILABLE: '/contracts',
  PLAYER_CONTRACT_SIGNED: '/contracts',
  // Injuries
  INJURY_OCCURRED: '/injuries',
  INJURY_READY_TO_RETURN: '/injuries',
  INJURY_RETURNED: '/injuries',
  // Transfers / Callups
  LOAN_OUT_EXPIRED: '/transfers',
  CALLUP_REQUESTED: '/player-callups',
  CALLUP_APPROVED: '/player-callups',
  CALLUP_REJECTED: '/player-callups',
  CALLUP_DOCS_READY: '/player-callups',
  // Training
  TRAINING_ATTENDANCE_WARNING: '/training/attendance',
  TRAINING_SESSION_PENDING: '/training',
  TRAINING_LOAD_ALERT: '/training',
  ATTENDANCE_PENALTY: '/training/attendance',
  ATTENDANCE_UNAUTHORIZED: '/training/attendance',
  ATTENDANCE_PENALTY_PLAYER: '/training/attendance',
  VIDEO_ASSIGNED: '/training/videos',
  VIDEO_ASSIGNMENT_OVERDUE: '/training/videos',
  // Matches / Tactical
  TACTICAL_ANALYSIS_CONFIRM_REQUESTED: '/matches/analysis',
  MATCH_DAY_REMINDER: '/matches',
  // Equipment
  EQUIPMENT_LOW_STOCK: '/equipment',
  // Reports
  EXTERNAL_REPORT_CREATED: '/reports',
  EXTERNAL_REPORT_DUE_SOON: '/reports',
  EXTERNAL_REPORT_OVERDUE: '/reports',
  REPORT_SUBMITTED: '/reports',
  REPORT_REJECTED: '/reports',
  // Medical expenses
  MEDICAL_EXPENSE_SUBMITTED: '/medical-expenses',
  MEDICAL_EXPENSE_LEADER_APPROVED: '/medical-expenses',
  MEDICAL_EXPENSE_REJECTED: '/medical-expenses',
  MEDICAL_EXPENSE_APPROVED: '/medical-expenses',
  // Coaches
  COACH_AUTO_SHORTLISTED: '/coaches',
  COACH_MANUALLY_SHORTLISTED: '/coaches',
  COACH_SHORTLISTED: '/coaches',
  COACH_APPROVAL_REQUESTED: '/coaches',
  COACH_APPROVAL_PENDING: '/coaches',
  COACH_CONTRACTED: '/coaches',
  COACH_HEAD_CONTRACTED: '/coaches',
  COACH_ARCHIVED: '/coaches',
  COACH_TUTOR_SUPPORT_NEEDED: '/coaches',
  // Players / Squad
  SQUAD_DEPTH_LOW: '/squad',
  JERSEY_NUMBER_CONFLICT: '/squad',
  PLAYER_DEVELOPMENT_PLAN_ACTIVATED: '/players',
  WORK_PERMIT_EXPIRY_SOON: '/players',
  // Youth
  YOUTH_REGISTRATION_STATUS_CHANGED: '/youth-registrations',
  YOUTH_WEEKLY_SCHEDULE: '/training',
  YOUTH_SESSION_CHANGED: '/training',
  INCIDENT_REPORT_SUBMITTED: '/incident-reports',
  GROWTH_REPORT_PUBLISHED: '/growth-reports',
  FEE_INVOICE_ISSUED: '/academy-fees',
  FEE_REMINDER: '/academy-fees',
  FEE_OVERDUE_WARNING: '/academy-fees',
  FEE_ACCOUNT_LOCKED: '/academy-fees',
  // Safety
  SAFEGUARD_EMERGENCY: '/safeguard-reports',
}

export const notificationApi = {
  my: () => api.get<NotificationItem[]>('/notifications/my'),
  markRead: (id: string) => api.patch<void>(`/notifications/${id}/read`, {}),
}
