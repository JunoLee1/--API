export interface AdminStats {
  activePlayerCount: number
  expiringContractCount: number
  injuredPlayerCount: number
  lowStockEquipmentCount: number
}

export interface GmStats {
  expiringContractCount: number
  injuredPlayerCount: number
  activeTransferCount: number
}

export interface TdStats {
  activeTransferCount: number
  prospectCount: number
  injuredPlayerCount: number
}

export interface ContractManagerStats {
  expiringContractCount: number
  totalActiveContractCount: number
}

export interface ScoutStats {
  prospectCount: number
  thisMonthProspectCount: number
}

export interface EquipmentManagerStats {
  lowStockEquipmentCount: number
  totalEquipmentItemCount: number
}

export interface TacticalAnalystStats {
  myDraftAnalysisCount: number
  thisMonthMatchCount: number
}

export interface HrManagerStats {
  totalStaffCount: number
  openJobPostingCount: number
  activeApplicationCount: number
}

export interface FinanceManagerStats {
  thisMonthExpense: number
  pendingOperatingExpenseCount: number
}

export interface AssetManagerStats {
  lowStockEquipmentCount: number
  totalEquipmentItemCount: number
  activeEquipmentLoanCount: number
}

export interface MedicalDashboardStats {
  currentInjuredCount: number
  weekNewInjuryCount: number
  returningIn7DaysCount: number
  reinjuryRiskCount: number
  incompleteDocCount: number
  pendingApprovalCount: number
  avgRecoveryDays: number | null
  injuriesByPosition: { GK: number; DF: number; MF: number; FW: number }
}

export interface HeadCoachStats {
  injuredPlayerCount: number
  thisMonthSessionCount: number
  attendanceWarningPlayerCount: number
  medicalDashboard?: MedicalDashboardStats
}

export interface SpecialistCoachStats {
  assignedPlayerCount: number
  myThisMonthSessionCount: number
}

export interface MedicalStats {
  myActiveInjuryCaseCount: number
  thisMonthReturnReadyCount: number
  medicalDashboard?: MedicalDashboardStats
}

export interface MedicalDirectorStats extends MedicalStats {
  totalInjuredPlayerCount: number
}

export interface PlayerStats {
  thisSeasonMatchCount: number
  thisMonthAttendanceRate: number
}

export interface AgentStats {
  managedPlayerCount: number
  injuredManagedPlayerCount: number
  expiringManagedContractCount: number
}

export type DashboardStats =
  | AdminStats
  | GmStats
  | TdStats
  | ContractManagerStats
  | ScoutStats
  | EquipmentManagerStats
  | TacticalAnalystStats
  | HeadCoachStats
  | SpecialistCoachStats
  | MedicalStats
  | MedicalDirectorStats
  | PlayerStats
  | AgentStats

export interface PlayerPdiEntry {
  playerId: string
  playerName: string
  teamId: number
  teamName: string
  totalMinutes: number
  slotDistribution: Record<string, number>
  biasedSlot: string | null
  biasedPct: number
  isBiased: boolean
}

export interface TeamPdiSummary {
  teamId: number
  teamName: string
  playerCount: number
  biasedPlayerCount: number
  players: PlayerPdiEntry[]
}

export interface YouthDevelopmentStats {
  teams: TeamPdiSummary[]
}
