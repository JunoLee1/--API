import { PartnerType, PartnerContractStatus, PartnerTier } from "../../generated/enums";

export interface CreatePartnerDto {
  type: PartnerType;
  name: string;
  country?: string;
  website?: string;
  address?: string;
  phone?: string;
}

export interface UpdatePartnerDto {
  name?: string;
  country?: string;
  website?: string;
  address?: string;
  phone?: string;
  tier?: PartnerTier | null;
  tierReason?: string | null;
}

export interface CreatePartnerContractDto {
  startDate: string;
  endDate: string;
  sponsorshipFee?: number;
  discountRate?: number;
  notes?: string;
  responseHours?: number;
  resolutionDays?: number;
  penaltyPerDay?: number;
}

export interface UpdatePartnerContractDto {
  status?: PartnerContractStatus;
  endDate?: string;
  sponsorshipFee?: number;
  discountRate?: number;
  notes?: string;
  responseHours?: number;
  resolutionDays?: number;
  penaltyPerDay?: number;
}
