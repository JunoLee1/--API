import { auth } from "../lib/authMiddleware";
import { Router } from "express";
import { AcademyFeeController } from "./academy-fee.controller";
import { AcademyFeeService } from "./academy-fee.service";
import { AcademyFeeRepository } from "./academy-fee.repo";
import { NotificationRepository } from "../notification/notification.repo";
import { getPrisma } from "../lib/prisma";
import { AppError } from "../lib/appError";
import { canReadHR, canWriteHR } from "../lib/permissions";
import multer from "multer";
import path from "path";
import fs from "fs";

const router = Router();

const proofUploadDir = path.join(process.cwd(), "uploads", "academy-fee-proofs");
if (!fs.existsSync(proofUploadDir)) fs.mkdirSync(proofUploadDir, { recursive: true });

const proofStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, proofUploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".pdf"];
    if (!allowed.includes(ext)) return cb(new Error("INVALID_EXTENSION"));
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const uploadProof = multer({
  storage: proofStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/") || file.mimetype === "application/pdf")
      cb(null, true);
    else cb(new Error("이미지 또는 PDF만 업로드할 수 있습니다."));
  },
});

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
  const { role, frontOfficeRole } = req.user!;
  if (!canReadHR(role, frontOfficeRole)) return next(new AppError(403, "FORBIDDEN"));
  next();
}, controller.getByPlayer);

router.post("/issue", auth, (req, res, next) => {
  const { role, frontOfficeRole } = req.user!;
  if (!canWriteHR(role, frontOfficeRole)) return next(new AppError(403, "FORBIDDEN"));
  next();
}, controller.issueMonthlyFees);

router.patch("/:id/submit-proof", auth, (req, res, next) => {
  const { role, frontOfficeRole } = req.user!;
  if (!canWriteHR(role, frontOfficeRole)) return next(new AppError(403, "FORBIDDEN"));
  next();
}, controller.submitPaymentProof);

router.patch("/:id/approve", auth, (req, res, next) => {
  const { role, frontOfficeRole } = req.user!;
  if (!canWriteHR(role, frontOfficeRole)) return next(new AppError(403, "FORBIDDEN"));
  next();
}, controller.approvePayment);

// 학부모: 계좌이체 증빙 파일 업로드 → SUBMITTED
router.post("/:id/upload-proof", auth, uploadProof.single("file"), async (req, res, next) => {
  const cleanup = () => { if (req.file) fs.unlink(req.file.path, () => {}); };
  try {
    const { role, id: userId } = req.user!;
    if (role !== "GUARDIAN") { cleanup(); return next(new AppError(403, "FORBIDDEN")); }
    if (!req.file) return next(new AppError(400, "FILE_REQUIRED"));
    const feeId = Number(req.params.id);
    const fee = await service.getById(feeId);
    if (fee.guardianId !== userId) { cleanup(); return next(new AppError(403, "FORBIDDEN")); }
    if (["SUBMITTED", "PAID"].includes(fee.status as string)) { cleanup(); return next(new AppError(409, "ALREADY_SUBMITTED")); }
    const url = `/uploads/academy-fee-proofs/${req.file.filename}`;
    const updated = await service.submitPaymentProof(feeId, { paymentProofUrl: url });
    res.json(updated);
  } catch (e) { cleanup(); next(e); }
});

export default router;
