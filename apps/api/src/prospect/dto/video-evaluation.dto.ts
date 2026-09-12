export interface PipelineData {
  detectionConfidence: number | undefined;   // YOLO 감지 신뢰도 0~1
  trackingScore: number | undefined;         // IOU+Feature 추적 일관성 0~1
  detectedJerseyNumbers: { number: number; confidence: number }[];
  playerCount?: number | undefined;
} 

export interface CreateProspectVideoEvaluationDto {
  qualityPassed: boolean;
  identifiable: boolean;
  continuity: boolean;
  jerseyNumber?: number | null;
  totalScore?: number | null;
  scoreData?: Record<string, number> | null;
  pipelineData?: PipelineData | null;
  notes?: string | null;
}

export interface UpdateProspectVideoEvaluationDto {
  qualityPassed?: boolean;
  identifiable?: boolean;
  continuity?: boolean;
  jerseyNumber?: number | null;
  totalScore?: number | null;
  scoreData?: Record<string, number> | null;
  pipelineData?: PipelineData | null;
  notes?: string | null;
}

export interface CreateProspectEvaluationLogDto {
  type: 'VIDEO_ANALYSIS' | 'CONSISTENCY' | 'FIELD_VISIT' | 'LEAGUE_LEVEL';
  note: string;
  evaluatedAt?: string; // ISO 날짜. 없으면 서버 now()
}
