import { TransferType, RecallStatus } from "../../generated/enums";

export interface CreateTransferDto {
  playerId: string;
  type: TransferType;
  date: string;
  startDate?: string;
  endDate?: string;
  fee?: number;
  fromClub?: string;
  toClub?: string;
}

export interface CreateRecallDto {
  transferId: number;
}

export interface UpdateRecallStatusDto {
  status: "APPROVED" | "REJECTED";
}
