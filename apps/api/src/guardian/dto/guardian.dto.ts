export interface LinkBySearchDto {
  studentCode: string;
  playerName: string;
  dateOfBirth: string; // ISO string
}

export interface LinkByCodeDto {
  code: string;
}

export interface IssueInviteCodeDto {
  playerId: string;
}
