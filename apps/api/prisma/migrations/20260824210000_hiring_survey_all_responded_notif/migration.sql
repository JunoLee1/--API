-- Add new notification type for "all target departments responded".
-- Fired from HiringSurveyService.submitResponse when the last target
-- dept submits, distinct from HIRING_SURVEY_CLOSED (fired on actual
-- close/mark-CLOSED). Recipient: HR manager.

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'HIRING_SURVEY_ALL_RESPONDED';
