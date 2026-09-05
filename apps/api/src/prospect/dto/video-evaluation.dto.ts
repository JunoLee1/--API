export interface CreateProspectVideoEvaluationDto {
  qualityPassed: boolean;
  identifiable: boolean;
  continuity: boolean;
  totalScore?: number | null;
  scoreData?: Record<string, number> | null;
  notes?: string | null;
}

export interface CreateProspectEvaluationLogDto {
  type: 'VIDEO_ANALYSIS' | 'CONSISTENCY' | 'FIELD_VISIT' | 'LEAGUE_LEVEL';
  note: string;
  evaluatedAt?: string; // ISO 날짜. 없으면 서버 now()
}
