export interface SaveSquadPlanDto {
  seasonId: number
  formation: string
  slots: Record<string, string | null>
}
