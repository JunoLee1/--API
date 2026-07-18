import { SessionType, ReferenceSource } from "../../generated/enums";

export interface CreateTrainingReferenceDto {
  sessionType: SessionType;
  title: string;
  url: string;
  source: ReferenceSource;
  tags: string[];
}

export interface ListTrainingReferencesQuery {
  sessionType?: SessionType;
  tag?: string;
}
