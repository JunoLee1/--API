-- #449 B3: mandatoryMinimum 승인 후 Basic 티어 위반 → GM 재편성 요청 알림 타입
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MANDATORY_MINIMUM_VIOLATION_REQUIRES_REPLAN';
