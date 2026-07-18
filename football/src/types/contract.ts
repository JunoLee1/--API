export type ContractStatus = 'ACTIVE' | 'EXPIRED' | 'TERMINATED'
export type BonusMetric =
  | 'GOALS' | 'ASSISTS' | 'APPEARANCES' | 'CLEAN_SHEETS' | 'SAVES'
  | 'PASS_ACCURACY' | 'TACKLE_SUCCESS_RATE' | 'CLEARANCES' | 'INTERCEPTIONS'
  | 'XG' | 'TEAM_RANK' | 'TEAM_WINS'
export type BonusPeriod = 'SEASON' | 'MONTH' | 'MATCH'
export type CompetitionType = 'LEAGUE' | 'CUP' | 'FRIENDLY' | 'CHAMPIONS_LEAGUE'
export type BonusTeamScope = 'ALL' | 'FIRST_TEAM_ONLY'

export interface BonusTrigger {
  id: number
  metric: BonusMetric
  threshold: number
  period: BonusPeriod
  competitionType: CompetitionType | null
}

export interface PerformanceBonus {
  id: number
  amount: number
  description: string
  triggers: BonusTrigger[]
}

export interface ContractSummary {
  id: number
  startDate: string
  endDate: string
  salary: number
  status: ContractStatus
  managedById: number | null
}

export interface ContractDetail extends ContractSummary {
  playerId: string
  buyoutClause: { id: number; amount: number } | null
  extensionOptions: Array<{ id: number; condition: string; durationMonths: number }>
  performanceBonuses: PerformanceBonus[]
}

export const CONTRACT_STATUS_LABEL: Record<ContractStatus, string> = {
  ACTIVE: '활성',
  EXPIRED: '만료',
  TERMINATED: '해지',
}

export const CONTRACT_STATUS_STYLE: Record<ContractStatus, string> = {
  ACTIVE: 'bg-green-100 text-green-800 border-green-200',
  EXPIRED: 'bg-gray-100 text-gray-500 border-gray-200',
  TERMINATED: 'bg-red-100 text-red-700 border-red-200',
}

export const BONUS_METRIC_LABEL: Record<BonusMetric, string> = {
  GOALS: '골',
  ASSISTS: '어시스트',
  APPEARANCES: '출전',
  CLEAN_SHEETS: '무실점',
  SAVES: '선방',
  PASS_ACCURACY: '패스 정확도(%)',
  TACKLE_SUCCESS_RATE: '태클 성공률(%)',
  CLEARANCES: '클리어',
  INTERCEPTIONS: '인터셉트',
  XG: 'xG',
  TEAM_RANK: '팀 순위',
  TEAM_WINS: '팀 승수',
}

export const BONUS_PERIOD_LABEL: Record<BonusPeriod, string> = {
  SEASON: '시즌',
  MONTH: '월',
  MATCH: '경기',
}

export interface CreateExtensionDto {
  condition: string
  durationMonths: number
}

export interface CreateBonusTriggerDto {
  metric: BonusMetric
  threshold: number
  period: BonusPeriod
  competitionType?: CompetitionType | null
  teamScope?: BonusTeamScope
}

export interface CreateBonusDto {
  amount: number
  description: string
  triggers: CreateBonusTriggerDto[]
}

export function formatSalary(salary: number): string {
  if (salary >= 100_000_000) return `${(salary / 100_000_000).toFixed(1)}억원`
  if (salary >= 10_000) return `${Math.round(salary / 10_000).toLocaleString()}만원`
  return `${salary.toLocaleString()}원`
}
