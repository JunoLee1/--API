export interface AssignJerseyDto {
  number: number;
  playerId?: string;
  status?: "OCCUPIED" | "RESERVED" | "RETIRED" | "AVAILABLE";
}

export interface UpdateJerseyStatusDto {
  status: "AVAILABLE" | "OCCUPIED" | "RETIRED" | "RESERVED";
  playerId?: string | null;
}
