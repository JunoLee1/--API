import { auth } from "../lib/authMiddleware";
import { AppError } from "../lib/appError";
import { Router, Request, Response, NextFunction } from "express";
import { RecruitmentRepository } from "./recruitment.repo";
import { RecruitmentService } from "./recruitment.service";
import { RecruitmentController } from "./recruitment.controller";
import { NotificationRepository } from "../notification/notification.repo";
import { PlanReportRepository } from "../plan-report/plan-report.repo";
import { getPrisma } from "../lib/prisma";

const router = Router();
const prisma = getPrisma();
const repo = new RecruitmentRepository(prisma);
const notifRepo = new NotificationRepository(prisma);
const planReportRepo = new PlanReportRepository(prisma);
const service = new RecruitmentService(repo, notifRepo, planReportRepo);
const controller = new RecruitmentController(service);

// 분석 엔드포인트
router.get("/headcount-progress", auth, controller.getHeadcountProgress);
router.get("/time-to-hire", auth, controller.getTimeToHireStats);

// JobPosting
router.get("/job-postings", auth, controller.listPostings);
router.post("/job-postings", auth, controller.createPosting);
router.get("/job-postings/:id", auth, controller.getPosting);
router.patch("/job-postings/:id", auth, controller.updatePosting);
router.post("/job-postings/:id/approve", auth, controller.approvePosting);
router.post("/job-postings/:id/close", auth, controller.closePosting);

// Applications under a posting
router.get("/job-postings/:postingId/applications", auth, controller.listApplications);
router.post("/job-postings/:postingId/applications", controller.apply);

// Application actions
// SJ9: PII in application record — restrict to HR/ADMIN/SUPER_ADMIN only
router.get(
  "/applications/:id",
  auth,
  (req: Request, res: Response, next: NextFunction) => {
    const role = req.user!.role;
    const foRole = (req.user as any).frontOfficeRole;
    const allowed =
      role === 'ADMIN' ||
      role === 'SUPER_ADMIN' ||
      (role === 'FRONT_OFFICE' && foRole === 'HR_MANAGER');
    if (!allowed) return next(new AppError(403, 'FORBIDDEN'));
    next();
  },
  controller.getApplication,
);
router.patch("/applications/:id", auth, controller.updateApplication);
router.post("/applications/:id/reject", auth, controller.rejectApplication);
router.post("/applications/:id/offer", auth, controller.offerApplication);

// Interviews
router.post("/applications/:id/interviews", auth, controller.scheduleInterview);
router.patch("/applications/:id/interviews/:round", auth, controller.updateInterview);
router.post("/interviews/:id/scores", auth, controller.addInterviewerScore);
router.get("/interviews/:id/scores", auth, controller.getInterviewerScores);

// Reference check
router.post("/applications/:id/reference-check", auth, controller.createReferenceCheck);
router.patch("/applications/:id/reference-check", auth, controller.updateReferenceCheck);

// Onboarding
router.post("/applications/:id/onboarding", auth, controller.startOnboarding);
router.post("/applications/:id/onboarding/verify-email", controller.verifyEmail);
router.post("/applications/:id/onboarding/complete-mfa", controller.completeMfa);

export default router;
