export interface FmVerifyDto {
  checklistOk?: boolean;
  photoUrl?: string;
  notes?: string;
}

export interface GmApproveDto {
  notes?: string;
}

export interface RejectDisposalDto {
  reason: string;
}
