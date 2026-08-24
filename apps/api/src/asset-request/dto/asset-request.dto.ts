export interface CreateAssetRequestDto {
  type: "SOFTWARE" | "HARDWARE";
  equipmentItemId?: number;
  softwareLicenseId?: number;
  customName?: string;
  customDescription?: string;
  expenseCategoryId: number;
  expectedAmount: number;
  neededBy?: string;
  justification: string;
}

export interface RejectDto {
  reason: string;
}

export interface ListAssetRequestQuery {
  filter?: "me" | "pending-leader" | "pending-dept-head" | "all";
  status?: string;
}
