import { InjuryCause, InjuryStatus, HospitalType, RehabStage, RiskLevel, SecurityLevel } from "../../generated/enums";

export interface CreateInjuryDto {
  playerId: string;
  bodyPart: string;
  cause: InjuryCause;
  expectedReturnDate?: string;
  medicalStaffId: number;
  hospitalType?: HospitalType;
  partnerId?: number;
  customHospitalName?: string;
}

export interface UpdateInjuryStatusDto {
  status: InjuryStatus;
  expectedReturnDate?: string;
}

export interface UpsertInjuryReportDto {
  diagnosisName?: string;
  treatmentContent?: string;
  rehabStage?: RehabStage;
  trainingReturnDate?: string;
  matchAvailable?: boolean;
  reinjuryRisk?: RiskLevel;
  medicalOpinion?: string;
  securityLevel?: SecurityLevel;
}
