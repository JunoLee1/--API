export interface GenerateSettlementDto {
  seasonId: number;
  year: number;
  month: number;
}

export interface UpdateNoteDto {
  note: string;
}

export interface RejectDto {
  reason: string;
}
