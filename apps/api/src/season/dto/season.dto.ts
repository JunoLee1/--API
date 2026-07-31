export interface CreateSeasonDto {
  name: string;
  startDate: string;
  endDate: string;
}

export interface SetWageCapDto {
  wageCapType: "FIXED" | "RATIO" | null;
  wageCapValue: number | null;
}
