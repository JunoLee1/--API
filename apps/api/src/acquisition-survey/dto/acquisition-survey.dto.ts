import { Position, SurveyPriority } from "../../generated/enums";

export interface CreateAcquisitionSurveyDto {
  title: string;
  dueDate?: string;
  notes?: string;
}

export interface SubmitAcquisitionSurveyResponseItemDto {
  position: Position;
  priority: SurveyPriority;
  budgetMin?: number;
  budgetMax?: number;
  notes?: string;
}
