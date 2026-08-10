import type { SponsorType, PaymentSchedule } from "../../generated/enums";

export interface CreateSponsorshipDto {
  sponsorName: string;
  type: SponsorType;
  totalFee: number;
  contractStart: string;
  contractEnd: string;
  paymentSchedule: PaymentSchedule;
  attachedContractId?: number;
  // 국내 계좌
  domesticBankName?: string;
  domesticAccountNumber?: string;
  domesticAccountHolder?: string;
  // 영국 계좌
  ukBankName?: string;
  ukSortCode?: string;
  ukAccountNumber?: string;
  ukSwiftBic?: string;
}

export interface UpdateSponsorshipDto {
  sponsorName?: string;
  type?: SponsorType;
  totalFee?: number;
  contractStart?: string;
  contractEnd?: string;
  paymentSchedule?: PaymentSchedule;
  attachedContractId?: number;
  // 국내 계좌
  domesticBankName?: string;
  domesticAccountNumber?: string;
  domesticAccountHolder?: string;
  // 영국 계좌
  ukBankName?: string;
  ukSortCode?: string;
  ukAccountNumber?: string;
  ukSwiftBic?: string;
}

export interface SponsorshipListQuery {
  type?: SponsorType;
  page?: string;
}
