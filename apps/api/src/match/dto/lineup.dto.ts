export interface LineupSlotDto {
  playerId: string;
  slotKey: string;
  isStarter: boolean;
}

export interface SaveLineupDto {
  formation: string;
  slots: LineupSlotDto[];
}
