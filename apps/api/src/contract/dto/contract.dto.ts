import { ContractStatus, BonusMetric, BonusPeriod, CompetitionType } from "../../generated/enums";

export interface CreateContractDto {
  playerId: string;
  startDate: string;
  endDate: string;
  salary: number;
  managedById?: number;
  agencyId?: number;
  agencyCommission?: number;
}

export interface UpdateContractStatusDto {
  status: ContractStatus;
}

export interface CreateBuyoutDto {
  amount: number;
  validUntil?: string;
}

export interface CreateExtensionDto {
  condition: string;
  durationMonths: number;
  conditionText?: string;
  minAppearances?: number;
}

export interface BonusTriggerDto {
  metric: BonusMetric;
  threshold: number;
  period: BonusPeriod;
  competitionType?: CompetitionType;
}

export interface CreateBonusDto {
  amount: number;
  description: string;
  triggers: BonusTriggerDto[];
}
