import type { UserDto } from '@/types/auth'
import type {
  AdminStats, GmStats, TdStats, ContractManagerStats, ScoutStats,
  EquipmentManagerStats, TacticalAnalystStats, HeadCoachStats,
  SpecialistCoachStats, MedicalStats, MedicalDirectorStats,
  PlayerStats, AgentStats, DashboardStats,
  HrManagerStats, FinanceManagerStats, AssetManagerStats,
} from '@/types/dashboard'

export interface StatCardConfig {
  label: string
  getValue: (stats: DashboardStats) => number | string
  unit?: string
  highlight?: boolean
}

export interface DashboardConfig {
  statCards: StatCardConfig[]
  showActionQueue: boolean
  showSchedule: boolean
  showRanking: boolean
  recentFeedTitle?: string
  showMedicalSection: boolean
  showYouthDevelopment: boolean
  showAcademyFinance?: boolean
  showOpsKpi?: 'finance' | 'hr' | 'all'
  showTicketRevenue?: boolean
}

export function getDashboardConfig(user: UserDto): DashboardConfig {
  const { role, coachingRole, frontOfficeRole } = user

  if (role === 'ADMIN') {
    return {
      statCards: [
        { label: 'dashboard.stat.activePlayerCount', getValue: (s) => (s as AdminStats).activePlayerCount, unit: 'dashboard.stat.unit.person' },
        { label: 'dashboard.stat.expiringContractCount', getValue: (s) => (s as AdminStats).expiringContractCount, unit: 'dashboard.stat.unit.case', highlight: true },
        { label: 'dashboard.stat.injuredPlayerCount', getValue: (s) => (s as AdminStats).injuredPlayerCount, unit: 'dashboard.stat.unit.person', highlight: true },
        { label: 'dashboard.stat.lowStockEquipmentCount', getValue: (s) => (s as AdminStats).lowStockEquipmentCount, unit: 'dashboard.stat.unit.item', highlight: true },
      ],
      showActionQueue: true,
      showSchedule: true,
      showRanking: false,
      showMedicalSection: false,
      showYouthDevelopment: true,
      showAcademyFinance: true,
      showOpsKpi: 'all',
    }
  }

  if (role === 'GM') {
    return {
      statCards: [
        { label: 'dashboard.stat.expiringContractCount', getValue: (s) => (s as GmStats).expiringContractCount, unit: 'dashboard.stat.unit.case', highlight: true },
        { label: 'dashboard.stat.injuredPlayerCount', getValue: (s) => (s as GmStats).injuredPlayerCount, unit: 'dashboard.stat.unit.person' },
        { label: 'dashboard.stat.activeTransferCount', getValue: (s) => (s as GmStats).activeTransferCount, unit: 'dashboard.stat.unit.case' },
      ],
      showActionQueue: true,
      showSchedule: true,
      recentFeedTitle: 'dashboard.recentFeed.recentTransfers',
      showRanking: false,
      showMedicalSection: false,
      showYouthDevelopment: false,
    }
  }

  if (role === 'FRONT_OFFICE') {
    if (frontOfficeRole === 'TD') {
      return {
        statCards: [
          { label: 'dashboard.stat.activeTransferCount', getValue: (s) => (s as TdStats).activeTransferCount, unit: 'dashboard.stat.unit.case' },
          { label: 'dashboard.stat.prospectCount', getValue: (s) => (s as TdStats).prospectCount, unit: 'dashboard.stat.unit.person' },
          { label: 'dashboard.stat.injuredPlayerCount', getValue: (s) => (s as TdStats).injuredPlayerCount, unit: 'dashboard.stat.unit.person' },
        ],
        showActionQueue: true,
        showSchedule: true,
        recentFeedTitle: 'dashboard.recentFeed.recentProspects',
        showRanking: false,
        showMedicalSection: false,
        showYouthDevelopment: true,
      }
    }
    if (frontOfficeRole === 'CONTRACT_MANAGER') {
      return {
        statCards: [
          { label: 'dashboard.stat.expiringContractCount', getValue: (s) => (s as ContractManagerStats).expiringContractCount, unit: 'dashboard.stat.unit.case', highlight: true },
          { label: 'dashboard.stat.totalActiveContractCount', getValue: (s) => (s as ContractManagerStats).totalActiveContractCount, unit: 'dashboard.stat.unit.case' },
        ],
        showActionQueue: true,
        showSchedule: false,
        recentFeedTitle: 'dashboard.recentFeed.recentContracts',
        showRanking: false,
        showMedicalSection: false,
        showYouthDevelopment: false,
      }
    }
    if (frontOfficeRole === 'SCOUT') {
      return {
        statCards: [
          { label: 'dashboard.stat.prospectCount', getValue: (s) => (s as ScoutStats).prospectCount, unit: 'dashboard.stat.unit.person' },
          { label: 'dashboard.stat.thisMonthProspectCount', getValue: (s) => (s as ScoutStats).thisMonthProspectCount, unit: 'dashboard.stat.unit.person' },
        ],
        showActionQueue: true,
        showSchedule: true,
        recentFeedTitle: 'dashboard.recentFeed.recentProspectList',
        showRanking: false,
        showMedicalSection: false,
        showYouthDevelopment: false,
      }
    }
    if (frontOfficeRole === 'EQUIPMENT_MANAGER') {
      return {
        statCards: [
          { label: 'dashboard.stat.lowStockEquipmentCount', getValue: (s) => (s as EquipmentManagerStats).lowStockEquipmentCount, unit: 'dashboard.stat.unit.item', highlight: true },
          { label: 'dashboard.stat.totalEquipmentItemCount', getValue: (s) => (s as EquipmentManagerStats).totalEquipmentItemCount, unit: 'dashboard.stat.unit.item' },
        ],
        showActionQueue: true,
        showSchedule: false,
        recentFeedTitle: 'dashboard.recentFeed.recentAssignments',
        showRanking: false,
        showMedicalSection: false,
        showYouthDevelopment: false,
      }
    }
    if (frontOfficeRole === 'TACTICAL_ANALYST') {
      return {
        statCards: [
          { label: 'dashboard.stat.myDraftAnalysisCount', getValue: (s) => (s as TacticalAnalystStats).myDraftAnalysisCount, unit: 'dashboard.stat.unit.case' },
          { label: 'dashboard.stat.thisMonthMatchCount', getValue: (s) => (s as TacticalAnalystStats).thisMonthMatchCount, unit: 'dashboard.stat.unit.match' },
        ],
        showActionQueue: true,
        showSchedule: true,
        recentFeedTitle: 'dashboard.recentFeed.recentMatches',
        showRanking: false,
        showMedicalSection: false,
        showYouthDevelopment: false,
      }
    }
    if (frontOfficeRole === 'HR_MANAGER') {
      return {
        statCards: [
          { label: 'dashboard.stat.totalStaffCount', getValue: (s) => (s as HrManagerStats).totalStaffCount, unit: 'dashboard.stat.unit.person' },
          { label: 'dashboard.stat.openJobPostingCount', getValue: (s) => (s as HrManagerStats).openJobPostingCount, unit: 'dashboard.stat.unit.case', highlight: true },
          { label: 'dashboard.stat.activeApplicationCount', getValue: (s) => (s as HrManagerStats).activeApplicationCount, unit: 'dashboard.stat.unit.person' },
        ],
        showActionQueue: false,
        showSchedule: false,
        recentFeedTitle: 'dashboard.recentFeed.recentApplications',
        showRanking: false,
        showMedicalSection: false,
        showYouthDevelopment: false,
        showOpsKpi: 'hr',
      }
    }
    if (frontOfficeRole === 'FINANCE_MANAGER') {
      return {
        statCards: [
          { label: 'dashboard.stat.thisMonthExpense', getValue: (s) => (s as FinanceManagerStats).thisMonthExpense.toLocaleString(), unit: 'dashboard.stat.unit.won' },
          { label: 'dashboard.stat.pendingOperatingExpenseCount', getValue: (s) => (s as FinanceManagerStats).pendingOperatingExpenseCount, unit: 'dashboard.stat.unit.case', highlight: true },
        ],
        showActionQueue: false,
        showSchedule: false,
        recentFeedTitle: 'dashboard.recentFeed.recentOperatingExpenses',
        showRanking: false,
        showMedicalSection: false,
        showYouthDevelopment: false,
        showOpsKpi: 'finance',
        showTicketRevenue: true,
      }
    }
    if (frontOfficeRole === 'ASSET_MANAGER') {
      return {
        statCards: [
          { label: 'dashboard.stat.lowStockEquipmentCount', getValue: (s) => (s as AssetManagerStats).lowStockEquipmentCount, unit: 'dashboard.stat.unit.item', highlight: true },
          { label: 'dashboard.stat.totalEquipmentItemCount', getValue: (s) => (s as AssetManagerStats).totalEquipmentItemCount, unit: 'dashboard.stat.unit.item' },
          { label: 'dashboard.stat.activeEquipmentLoanCount', getValue: (s) => (s as AssetManagerStats).activeEquipmentLoanCount, unit: 'dashboard.stat.unit.case' },
        ],
        showActionQueue: false,
        showSchedule: false,
        recentFeedTitle: 'dashboard.recentFeed.recentAssignments',
        showRanking: false,
        showMedicalSection: false,
        showYouthDevelopment: false,
      }
    }
  }

  if (role === 'COACHING_STAFF') {
    if (coachingRole === 'HEAD_COACH') {
      return {
        statCards: [
          { label: 'dashboard.stat.injuredPlayerCount', getValue: (s) => (s as HeadCoachStats).injuredPlayerCount, unit: 'dashboard.stat.unit.person', highlight: true },
          { label: 'dashboard.stat.thisMonthSessionCount', getValue: (s) => (s as HeadCoachStats).thisMonthSessionCount, unit: 'dashboard.stat.unit.session' },
          { label: 'dashboard.stat.attendanceWarningPlayerCount', getValue: (s) => (s as HeadCoachStats).attendanceWarningPlayerCount, unit: 'dashboard.stat.unit.person', highlight: true },
        ],
        showActionQueue: true,
        showSchedule: true,
        showRanking: true,
        recentFeedTitle: 'dashboard.recentFeed.recentMatches',
        showMedicalSection: true,
        showYouthDevelopment: false,
      }
    }
    if (coachingRole === 'ASSISTANT_COACH') {
      return {
        statCards: [
          { label: 'dashboard.stat.injuredPlayerCount', getValue: (s) => (s as HeadCoachStats).injuredPlayerCount, unit: 'dashboard.stat.unit.person', highlight: true },
          { label: 'dashboard.stat.thisMonthSessionCount', getValue: (s) => (s as HeadCoachStats).thisMonthSessionCount, unit: 'dashboard.stat.unit.session' },
          { label: 'dashboard.stat.attendanceWarningPlayerCount', getValue: (s) => (s as HeadCoachStats).attendanceWarningPlayerCount, unit: 'dashboard.stat.unit.person', highlight: true },
        ],
        showActionQueue: true,
        showSchedule: true,
        showRanking: true,
        recentFeedTitle: 'dashboard.recentFeed.recentMatches',
        showMedicalSection: false,
        showYouthDevelopment: false,
      }
    }
    if (coachingRole === 'MEDICAL_DIRECTOR') {
      return {
        statCards: [
          { label: 'dashboard.stat.myActiveInjuryCaseCount', getValue: (s) => (s as MedicalDirectorStats).myActiveInjuryCaseCount, unit: 'dashboard.stat.unit.case' },
          { label: 'dashboard.stat.thisMonthReturnReadyCount', getValue: (s) => (s as MedicalDirectorStats).thisMonthReturnReadyCount, unit: 'dashboard.stat.unit.case' },
          { label: 'dashboard.stat.totalInjuredPlayerCount', getValue: (s) => (s as MedicalDirectorStats).totalInjuredPlayerCount, unit: 'dashboard.stat.unit.person', highlight: true },
        ],
        showActionQueue: true,
        showSchedule: false,
        recentFeedTitle: 'dashboard.recentFeed.recentInjuries',
        showRanking: false,
        showMedicalSection: true,
        showYouthDevelopment: false,
      }
    }
    if (coachingRole === 'MEDICAL') {
      return {
        statCards: [
          { label: 'dashboard.stat.myActiveInjuryCaseCount', getValue: (s) => (s as MedicalStats).myActiveInjuryCaseCount, unit: 'dashboard.stat.unit.case' },
          { label: 'dashboard.stat.thisMonthReturnReadyCount', getValue: (s) => (s as MedicalStats).thisMonthReturnReadyCount, unit: 'dashboard.stat.unit.case' },
        ],
        showActionQueue: true,
        showSchedule: false,
        recentFeedTitle: 'dashboard.recentFeed.recentInjuries',
        showRanking: false,
        showMedicalSection: true,
        showYouthDevelopment: false,
      }
    }
    // DEFENSIVE/ATTACKING/SET_PIECE/GOALKEEPER/PHYSICAL
    return {
      statCards: [
        { label: 'dashboard.stat.assignedPlayerCount', getValue: (s) => (s as SpecialistCoachStats).assignedPlayerCount, unit: 'dashboard.stat.unit.person' },
        { label: 'dashboard.stat.myThisMonthSessionCount', getValue: (s) => (s as SpecialistCoachStats).myThisMonthSessionCount, unit: 'dashboard.stat.unit.session' },
      ],
      showActionQueue: true,
      showSchedule: true,
      recentFeedTitle: 'dashboard.recentFeed.recentSessions',
      showRanking: false,
      showMedicalSection: false,
      showYouthDevelopment: false,
    }
  }

  if (role === 'PLAYER') {
    return {
      statCards: [
        { label: 'dashboard.stat.thisSeasonMatchCount', getValue: (s) => (s as PlayerStats).thisSeasonMatchCount, unit: 'dashboard.stat.unit.match' },
        { label: 'dashboard.stat.thisMonthAttendanceRate', getValue: (s) => (s as PlayerStats).thisMonthAttendanceRate, unit: 'dashboard.stat.unit.rate' },
      ],
      showActionQueue: true,
      showSchedule: true,
      recentFeedTitle: 'dashboard.recentFeed.recentPlayerMatches',
      showRanking: false,
      showMedicalSection: false,
      showYouthDevelopment: false,
    }
  }

  // AGENT
  return {
    statCards: [
      { label: 'dashboard.stat.managedPlayerCount', getValue: (s) => (s as AgentStats).managedPlayerCount, unit: 'dashboard.stat.unit.person' },
      { label: 'dashboard.stat.injuredManagedPlayerCount', getValue: (s) => (s as AgentStats).injuredManagedPlayerCount, unit: 'dashboard.stat.unit.person', highlight: true },
      { label: 'dashboard.stat.expiringManagedContractCount', getValue: (s) => (s as AgentStats).expiringManagedContractCount, unit: 'dashboard.stat.unit.case', highlight: true },
    ],
    showActionQueue: true,
    showSchedule: true,
    recentFeedTitle: 'dashboard.recentFeed.recentPlayerMatches',
    showRanking: false,
    showMedicalSection: false,
    showYouthDevelopment: false,
  }
}
