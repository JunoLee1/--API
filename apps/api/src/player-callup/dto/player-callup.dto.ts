export interface CreateCallupDto {
  playerId: string;
  fromTeamId: number;
  toTeamId: number;
  reason: string;
  startDate: string;
  endDate?: string;
  callupType?: "TRAINING" | "OFFICIAL";
}

export interface RejectCallupDto {
  reason: string;
}

export interface CallupListQuery {
  status?: string;
}
