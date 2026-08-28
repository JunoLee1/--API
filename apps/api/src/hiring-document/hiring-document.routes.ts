import fs from "fs";
import path from "path";
import { Router } from "express";
import multer from "multer";
import { auth } from "../lib/authMiddleware";
import { getPrisma } from "../lib/prisma";
import { HiringDocumentController } from "./hiring-document.controller";
import { HiringDocumentRepository } from "./hiring-document.repo";
import { HiringDocumentService } from "./hiring-document.service";

// Same allowlist as `hr.routes.ts` — PDF + docx/xlsx + Hangul word processor.
// Adding image formats (jpg/png) up front so scanned IDs / bank slips don't
// need conversion on the way in.
const ALLOWED_MIMES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/x-hwp",
  "application/haansofthwp",
  "image/jpeg",
  "image/png",
];

const UPLOAD_DIR = path.join(__dirname, "../../uploads/hiring-documents");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
      // Sanitize but keep original extension so downstream tooling can still
      // dispatch by MIME. Prefix with timestamp for lexicographic ordering.
      const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
      cb(null, `${Date.now()}-${safe}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB — same ceiling as other HR uploads
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMES.includes(file.mimetype)) cb(null, true);
    else cb(new Error("INVALID_FILE_TYPE"));
  },
});

const prisma = getPrisma();
const repo = new HiringDocumentRepository(prisma);
const service = new HiringDocumentService(repo, prisma);
const controller = new HiringDocumentController(service);

const router = Router();

// POST /hiring-documents — multipart upload (docType + applicationId XOR
// hiringDispatchId in the form body, file in `file` field).
router.post("/", auth, upload.single("file"), controller.upload);

// PATCH /hiring-documents/:id/review — {status, reviewNotes?}
router.patch("/:id/review", auth, controller.review);

// GET /hiring-documents?applicationId=xxx  OR  ?hiringDispatchId=xxx
// Returns the "current" set — latest row per docType.
router.get("/", auth, controller.listCurrent);

// GET /hiring-documents/history?applicationId=xxx&docType=xxx  (or hiringDispatchId)
// Returns the full history for a single docType, newest first.
router.get("/history", auth, controller.listHistory);

/**
 * Exports used by other modules to reuse the same singleton service (avoids
 * a second Prisma client). `hiring-dispatch.routes.ts` composes this service
 * into HiringDispatchService for the EXECUTION gate.
 */
export { service as hiringDocumentService, repo as hiringDocumentRepo };

export default router;
