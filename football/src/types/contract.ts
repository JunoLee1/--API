export type ContractStatus = 'ACTIVE' | 'EXPIRED' | 'TERMINATED'
export type BonusMetric =
  | 'GOALS' | 'ASSISTS' | 'APPEARANCES' | 'CLEAN_SHEETS' | 'SAVES'
  | 'PASS_ACCURACY' | 'TACKLE_SUCCESS_RATE' | 'CLEARANCES' | 'INTERCEPTIONS'
  | 'XG' | 'TEAM_RANK' | 'TEAM_WINS'
export type BonusPeriod = 'SEASON' | 'MONTH' | 'MATCH'
export type CompetitionType = 'LEAGUE' | 'CUP' | 'FRIENDLY' | 'CHAMPIONS_LEAGUE'

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

export function formatSalary(salary: number): string {
  if (salary >= 100_000_000) return `${(salary / 100_000_000).toFixed(1)}억원`
  if (salary >= 10_000) return `${Math.round(salary / 10_000).toLocaleString()}만원`
  return `${salary.toLocaleString()}원`
}
