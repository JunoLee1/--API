import { auth } from "../lib/authMiddleware";
import { Router } from "express";
import { AcademyFeeController } from "./academy-fee.controller";
import { AcademyFeeService } from "./academy-fee.service";
import { AcademyFeeRepository } from "./academy-fee.repo";
import { NotificationRepository } from "../notification/notification.repo";
import { getPrisma } from "../lib/prisma";
import { AppError } from "../lib/appError";
import { canReadHR, canWriteHR } from "../lib/permissions";

const router = Router();
const prisma = getPrisma();
const service = new AcademyFeeService(new AcademyFeeRepository(prisma), new NotificationRepository(prisma));
const controller = new AcademyFeeController(service);

router.get("/stats", auth, (req, res, next) => {
  const { role, frontOfficeRole } = req.user!;
  if (!canReadHR(role, frontOfficeRole)) return next(new AppError(403, "FORBIDDEN"));
  next();
}, controller.getStats);

router.get("/", auth, (req, res, next) => {
  const { role, frontOfficeRole } = req.user!;
  if (!canReadHR(role, frontOfficeRole)) return next(new AppError(403, "FORBIDDEN"));
  next();
}, controller.getAll);

router.get("/player/:playerId", auth, (req, res, next) => {
  const { role } = req.user!;
  if (role !== 'GUARDIAN' && !canReadHR(role, req.user!.frontOfficeRole)) {
    return next(new AppError(403, "FORBIDDEN"));
  }
  next();
}, controller.getByPlayer);

router.post("/issue", auth, (req, res, next) => {
  const { role, frontOfficeRole } = req.user!;
  if (!canWriteHR(role, frontOfficeRole)) return next(new AppError(403, "FORBIDDEN"));
  next();
}, controller.issueMonthlyFees);

router.patch("/:id/submit-proof", auth, (req, res, next) => {
  const { role } = req.user!;
  if (role !== 'GUARDIAN' && !canWriteHR(role, req.user!.frontOfficeRole)) {
    return next(new AppError(403, "FORBIDDEN"));
  }
  next();
}, controller.submitPaymentProof);

router.patch("/:id/approve", auth, (req, res, next) => {
  const { role, frontOfficeRole } = req.user!;
  if (!canWriteHR(role, frontOfficeRole)) return next(new AppError(403, "FORBIDDEN"));
  next();
}, controller.approvePayment);

export default router;
