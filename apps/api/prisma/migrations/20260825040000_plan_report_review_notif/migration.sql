-- AlterEnum: NotificationType ADD VALUE — must run OUTSIDE transaction block
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PLAN_REPORT_REVIEW_REQUESTED';
