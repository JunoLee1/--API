import fs from "fs";
import path from "path";
import { Router } from "express";
import multer from "multer";
import { auth } from "../lib/authMiddleware";
import { getPrisma } from "../lib/prisma";
import { EmployeeContractController } from "./employee-contract.controller";
import { EmployeeContractRepository } from "./employee-contract.repo";
import { EmployeeContractService } from "./employee-contract.service";

/**
 * Multer setup mirrors hiring-document.routes.ts — PDF + images (JPG/PNG),
 * 10 MB ceiling, sanitized + timestamped filenames. Employee contracts don't
 * expect Word/Excel/HWP formats today (scanned signature pages are the
 * dominant flow), so the allowlist is narrower than the HR document one.
 */
const ALLOWED_MIMES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
];

const UPLOAD_DIR = path.join(__dirname, "../../uploads/employee-contracts");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
      // Same sanitization as the sibling hiring-document uploader.
      const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
      cb(null, `${Date.now()}-${safe}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMES.includes(file.mimetype)) cb(null, true);
    else cb(new Error("INVALID_FILE_TYPE"));
  },
});

const prisma = getPrisma();
const repo = new EmployeeContractRepository(prisma);
const service = new EmployeeContractService(repo, prisma);
const controller = new EmployeeContractController(service);

const router = Router();

// POST /employee-contracts — { hiringDispatchId } → creates DRAFT row.
router.post("/", auth, controller.create);

// PATCH /employee-contracts/:id/issue — multipart file → DRAFT → ISSUED.
router.patch("/:id/issue", auth, upload.single("file"), controller.issue);

// PATCH /employee-contracts/:id/sign — multipart file + signedAt → ISSUED → SIGNED.
router.patch("/:id/sign", auth, upload.single("file"), controller.sign);

// PATCH /employee-contracts/:id/cancel — { cancelReason } → CANCELLED.
router.patch("/:id/cancel", auth, controller.cancel);

// GET /employee-contracts/dispatch/:hiringDispatchId — full history.
router.get("/dispatch/:hiringDispatchId", auth, controller.listByDispatch);

/**
 * Exports used by hiring-dispatch.routes.ts to compose the same singleton
 * service into HiringDispatchService for the EXECUTION gate — avoids a
 * second Prisma client and keeps the "one service per module" pattern.
 */
export { service as employeeContractService, repo as employeeContractRepo };

export default router;
