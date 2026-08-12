export interface CreateFormationSnapshotDto {
  matchId: number;
  minute?: number;
  formation: string;
  changeReason?: string;
}
