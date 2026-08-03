import type { SponsorType, PaymentSchedule } from "../../generated/enums";

export interface CreateSponsorshipDto {
  sponsorName: string;
  type: SponsorType;
  totalFee: number;
  contractStart: string;
  contractEnd: string;
  paymentSchedule: PaymentSchedule;
  attachedContractId?: number;
}

export interface UpdateSponsorshipDto {
  sponsorName?: string;
  type?: SponsorType;
  totalFee?: number;
  contractStart?: string;
  contractEnd?: string;
  paymentSchedule?: PaymentSchedule;
  attachedContractId?: number;
}

export interface SponsorshipListQuery {
  type?: SponsorType;
  page?: string;
}
