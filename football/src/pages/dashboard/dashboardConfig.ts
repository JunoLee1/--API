import type { UserDto } from '@/types/auth'
import type {
  AdminStats, GmStats, TdStats, ContractManagerStats, ScoutStats,
  EquipmentManagerStats, TacticalAnalystStats, HeadCoachStats,
  SpecialistCoachStats, MedicalStats, MedicalDirectorStats,
  PlayerStats, AgentStats, DashboardStats,
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
}

export function getDashboardConfig(user: UserDto): DashboardConfig {
  const { role, coachingRole, frontOfficeRole } = user

  if (role === 'ADMIN') {
    return {
      statCards: [
        { label: '활성 선수', getValue: (s) => (s as AdminStats).activePlayerCount, unit: '명' },
        { label: '만료 임박 계약', getValue: (s) => (s as AdminStats).expiringContractCount, unit: '건', highlight: true },
        { label: '부상 선수', getValue: (s) => (s as AdminStats).injuredPlayerCount, unit: '명', highlight: true },
        { label: '재고 부족 장비', getValue: (s) => (s as AdminStats).lowStockEquipmentCount, unit: '종', highlight: true },
      ],
      showActionQueue: true,
      showSchedule: true,
      showRanking: false,
        showMedicalSection: false,
    }
  }

  if (role === 'FRONT_OFFICE') {
    if (frontOfficeRole === 'GM') {
      return {
        statCards: [
          { label: '만료 임박 계약', getValue: (s) => (s as GmStats).expiringContractCount, unit: '건', highlight: true },
          { label: '부상 선수', getValue: (s) => (s as GmStats).injuredPlayerCount, unit: '명' },
          { label: '진행 중 이적', getValue: (s) => (s as GmStats).activeTransferCount, unit: '건' },
        ],
        showActionQueue: true,
        showSchedule: true,
        recentFeedTitle: '최근 이적 내역',
        showRanking: false,
        showMedicalSection: false,
      }
    }
    if (frontOfficeRole === 'TD') {
      return {
        statCards: [
          { label: '진행 중 이적', getValue: (s) => (s as TdStats).activeTransferCount, unit: '건' },
          { label: '등록된 Prospect', getValue: (s) => (s as TdStats).prospectCount, unit: '명' },
          { label: '부상 선수', getValue: (s) => (s as TdStats).injuredPlayerCount, unit: '명' },
        ],
        showActionQueue: true,
        showSchedule: true,
        recentFeedTitle: '최근 Prospect',
        showRanking: false,
        showMedicalSection: false,
      }
    }
    if (frontOfficeRole === 'CONTRACT_MANAGER') {
      return {
        statCards: [
          { label: '만료 임박 계약', getValue: (s) => (s as ContractManagerStats).expiringContractCount, unit: '건', highlight: true },
          { label: '전체 활성 계약', getValue: (s) => (s as ContractManagerStats).totalActiveContractCount, unit: '건' },
        ],
        showActionQueue: true,
        showSchedule: false,
        recentFeedTitle: '최근 계약 현황',
        showRanking: false,
        showMedicalSection: false,
      }
    }
    if (frontOfficeRole === 'SCOUT') {
      return {
        statCards: [
          { label: '등록된 Prospect', getValue: (s) => (s as ScoutStats).prospectCount, unit: '명' },
          { label: '이번 달 신규 Prospect', getValue: (s) => (s as ScoutStats).thisMonthProspectCount, unit: '명' },
        ],
        showActionQueue: true,
        showSchedule: true,
        recentFeedTitle: '최근 Prospect 목록',
        showRanking: false,
        showMedicalSection: false,
      }
    }
    if (frontOfficeRole === 'EQUIPMENT_MANAGER') {
      return {
        statCards: [
          { label: '재고 부족 장비', getValue: (s) => (s as EquipmentManagerStats).lowStockEquipmentCount, unit: '종', highlight: true },
          { label: '전체 장비 품목', getValue: (s) => (s as EquipmentManagerStats).totalEquipmentItemCount, unit: '종' },
        ],
        showActionQueue: true,
        showSchedule: false,
        recentFeedTitle: '최근 장비 지급 내역',
        showRanking: false,
        showMedicalSection: false,
      }
    }
    if (frontOfficeRole === 'TACTICAL_ANALYST') {
      return {
        statCards: [
          { label: '내 DRAFT 분석', getValue: (s) => (s as TacticalAnalystStats).myDraftAnalysisCount, unit: '건' },
          { label: '이번 달 경기', getValue: (s) => (s as TacticalAnalystStats).thisMonthMatchCount, unit: '경기' },
        ],
        showActionQueue: true,
        showSchedule: true,
        recentFeedTitle: '최근 경기 결과',
        showRanking: false,
        showMedicalSection: false,
      }
    }
  }

  if (role === 'COACHING_STAFF') {
    if (coachingRole === 'HEAD_COACH') {
      return {
        statCards: [
          { label: '부상 선수', getValue: (s) => (s as HeadCoachStats).injuredPlayerCount, unit: '명', highlight: true },
          { label: '이번 달 훈련 세션', getValue: (s) => (s as HeadCoachStats).thisMonthSessionCount, unit: '회' },
          { label: '출석 경고 선수', getValue: (s) => (s as HeadCoachStats).attendanceWarningPlayerCount, unit: '명', highlight: true },
        ],
        showActionQueue: true,
        showSchedule: true,
        showRanking: true,
        recentFeedTitle: '최근 경기 결과',
        showMedicalSection: true,
      }
    }
    if (coachingRole === 'ASSISTANT_COACH') {
      return {
        statCards: [
          { label: '부상 선수', getValue: (s) => (s as HeadCoachStats).injuredPlayerCount, unit: '명', highlight: true },
          { label: '이번 달 훈련 세션', getValue: (s) => (s as HeadCoachStats).thisMonthSessionCount, unit: '회' },
          { label: '출석 경고 선수', getValue: (s) => (s as HeadCoachStats).attendanceWarningPlayerCount, unit: '명', highlight: true },
        ],
        showActionQueue: true,
        showSchedule: true,
        showRanking: true,
        recentFeedTitle: '최근 경기 결과',
        showMedicalSection: false,
      }
    }
    if (coachingRole === 'MEDICAL_DIRECTOR') {
      return {
        statCards: [
          { label: '내 담당 부상 케이스', getValue: (s) => (s as MedicalDirectorStats).myActiveInjuryCaseCount, unit: '건' },
          { label: '이번 달 복귀 가능 전환', getValue: (s) => (s as MedicalDirectorStats).thisMonthReturnReadyCount, unit: '건' },
          { label: '전체 부상 선수', getValue: (s) => (s as MedicalDirectorStats).totalInjuredPlayerCount, unit: '명', highlight: true },
        ],
        showActionQueue: true,
        showSchedule: false,
        recentFeedTitle: '최근 부상 업데이트',
        showRanking: false,
        showMedicalSection: true,
      }
    }
    if (coachingRole === 'MEDICAL') {
      return {
        statCards: [
          { label: '내 담당 부상 케이스', getValue: (s) => (s as MedicalStats).myActiveInjuryCaseCount, unit: '건' },
          { label: '이번 달 복귀 가능 전환', getValue: (s) => (s as MedicalStats).thisMonthReturnReadyCount, unit: '건' },
        ],
        showActionQueue: true,
        showSchedule: false,
        recentFeedTitle: '최근 부상 업데이트',
        showRanking: false,
        showMedicalSection: true,
      }
    }
    // DEFENSIVE/ATTACKING/SET_PIECE/GOALKEEPER/PHYSICAL
    return {
      statCards: [
        { label: '담당 선수 수', getValue: (s) => (s as SpecialistCoachStats).assignedPlayerCount, unit: '명' },
        { label: '이번 달 내 세션', getValue: (s) => (s as SpecialistCoachStats).myThisMonthSessionCount, unit: '회' },
      ],
      showActionQueue: true,
      showSchedule: true,
      recentFeedTitle: '최근 훈련 세션',
      showRanking: false,
        showMedicalSection: false,
    }
  }

  if (role === 'PLAYER') {
    return {
      statCards: [
        { label: '이번 시즌 출전 경기', getValue: (s) => (s as PlayerStats).thisSeasonMatchCount, unit: '경기' },
        { label: '이번 달 출석률', getValue: (s) => (s as PlayerStats).thisMonthAttendanceRate, unit: '%' },
      ],
      showActionQueue: true,
      showSchedule: true,
      recentFeedTitle: '최근 출전 경기',
      showRanking: false,
        showMedicalSection: false,
    }
  }

  // AGENT
  return {
    statCards: [
      { label: '담당 선수', getValue: (s) => (s as AgentStats).managedPlayerCount, unit: '명' },
      { label: '부상 중인 담당 선수', getValue: (s) => (s as AgentStats).injuredManagedPlayerCount, unit: '명', highlight: true },
      { label: '만료 임박 계약', getValue: (s) => (s as AgentStats).expiringManagedContractCount, unit: '건', highlight: true },
    ],
    showActionQueue: true,
    showSchedule: true,
    recentFeedTitle: '담당 선수 최근 경기',
    showRanking: false,
        showMedicalSection: false,
  }
}
