import type { ClauseType } from "../../../generated/enums";

export interface CreateClauseDto {
  type: ClauseType;
  condition: string;
  rate?: number;
  fixedAmount?: number;
}
