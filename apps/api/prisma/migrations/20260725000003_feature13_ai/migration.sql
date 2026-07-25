-- Match 테이블: OCR 결과 저장 필드 추가
ALTER TABLE "Match" ADD COLUMN "statSheetRaw" JSONB;
ALTER TABLE "Match" ADD COLUMN "statSheetImagePath" TEXT;

-- TrainingVideo 테이블: AI 요약 저장 필드 추가
ALTER TABLE "TrainingVideo" ADD COLUMN "aiSummary" TEXT;
