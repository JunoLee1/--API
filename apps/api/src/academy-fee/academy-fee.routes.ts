import { auth } from "../lib/authMiddleware";
import { Router } from "express";
import { AcademyFeeController } from "./academy-fee.controller";
import { AcademyFeeService } from "./academy-fee.service";
import { AcademyFeeRepository } from "./academy-fee.repo";
import { NotificationRepository } from "../notification/notification.repo";
import { getPrisma } from "../lib/prisma";

const router = Router();
const prisma = getPrisma();
const service = new AcademyFeeService(new AcademyFeeRepository(prisma), new NotificationRepository(prisma));
const controller = new AcademyFeeController(service);

router.get("/stats", auth, controller.getStats);
router.get("/", auth, controller.getAll);
router.get("/player/:playerId", auth, controller.getByPlayer);
router.post("/issue", auth, controller.issueMonthlyFees);
router.patch("/:id/submit-proof", auth, controller.submitPaymentProof);
router.patch("/:id/approve", auth, controller.approvePayment);

export default router;
