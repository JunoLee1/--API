import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { auth } from "../lib/authMiddleware";
import type { Request, Response, NextFunction } from "express";
import { canReadHR } from "../lib/permissions";
import { uploadDocument } from "./hr.controller";

const ALLOWED_MIMES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/x-hwp",
  "application/haansofthwp",
];

const UPLOAD_DIR = path.join(__dirname, "../../uploads/hr-documents");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
      const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
      cb(null, `${Date.now()}-${safe}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("INVALID_FILE_TYPE"));
    }
  },
});

function requireHR(req: Request, res: Response, next: NextFunction) {
  const user = req.user;
  if (!user) return res.status(401).json({ error: "UNAUTHENTICATED" });
  if (!canReadHR(user.role, user.frontOfficeRole)) return res.status(403).json({ error: "FORBIDDEN" });
  next();
}

const router = Router();
router.post("/documents", auth, requireHR, upload.single("file"), uploadDocument);
export default router;
