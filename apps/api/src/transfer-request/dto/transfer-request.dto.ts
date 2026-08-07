import { TransferType, TransferRequestStatus } from "../../generated/enums";

export interface CreateTransferRequestDto {
  playerId: string;
  agencyId: number;
  type: TransferType;
  fromClub?: string;
  toClub?: string;
  fee?: number;
  startDate?: string;
  endDate?: string;
}

export interface UpdateTransferRequestDto {
  type?: TransferType;
  fromClub?: string | null;
  toClub?: string | null;
  fee?: number | null;
  startDate?: string | null;
  endDate?: string | null;
}

export interface ReviewTransferRequestDto {
  action: "approve" | "reject";
  rejectReason?: string;
}

export interface ConfirmTransferRequestDto {
  action: "confirm" | "reject";
  rejectReason?: string;
}

export interface ListTransferRequestQuery {
  status?: TransferRequestStatus;
  playerId?: string;
}
