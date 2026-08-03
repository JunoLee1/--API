import { auth } from "../lib/authMiddleware";
import { Router } from "express";
import { RecruitmentRepository } from "./recruitment.repo";
import { RecruitmentService } from "./recruitment.service";
import { RecruitmentController } from "./recruitment.controller";
import { getPrisma } from "../lib/prisma";

const router = Router();
const repo = new RecruitmentRepository(getPrisma());
const service = new RecruitmentService(repo);
const controller = new RecruitmentController(service);

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
router.get("/applications/:id", auth, controller.getApplication);
router.patch("/applications/:id", auth, controller.updateApplication);
router.post("/applications/:id/reject", auth, controller.rejectApplication);
router.post("/applications/:id/offer", auth, controller.offerApplication);

// Interviews
router.post("/applications/:id/interviews", auth, controller.scheduleInterview);
router.patch("/applications/:id/interviews/:round", auth, controller.updateInterview);

// Reference check
router.post("/applications/:id/reference-check", auth, controller.createReferenceCheck);
router.patch("/applications/:id/reference-check", auth, controller.updateReferenceCheck);

// Onboarding
router.post("/applications/:id/onboarding", auth, controller.startOnboarding);
router.post("/applications/:id/onboarding/verify-email", controller.verifyEmail);
router.post("/applications/:id/onboarding/complete-mfa", controller.completeMfa);

export default router;
