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

export interface HeadCoachStats {
  injuredPlayerCount: number
  thisMonthSessionCount: number
  attendanceWarningPlayerCount: number
}

export interface SpecialistCoachStats {
  assignedPlayerCount: number
  myThisMonthSessionCount: number
}

export interface MedicalStats {
  myActiveInjuryCaseCount: number
  thisMonthReturnReadyCount: number
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
