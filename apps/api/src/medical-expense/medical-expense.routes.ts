import { Router } from "express";
import passport from "passport";
import multer from "multer";
import path from "path";
import fs from "fs";
import { MedicalExpenseController } from "./medical-expense.controller";
import { MedicalExpenseService } from "./medical-expense.service";
import { MedicalExpenseRepository } from "./medical-expense.repo";
import { NotificationRepository } from "../notification/notification.repo";
import { getPrisma } from "../lib/prisma";

const router = Router();
const prisma = getPrisma();
const repo = new MedicalExpenseRepository(prisma);
const notifRepo = new NotificationRepository(prisma);
const service = new MedicalExpenseService(repo, notifRepo);
const controller = new MedicalExpenseController(service);

const auth = passport.authenticate("accessToken", { session: false });

const uploadDir = path.join(process.cwd(), "uploads", "medical-expenses");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

router.get("/", auth, controller.list);
router.post("/", auth, upload.single("file"), controller.create);
router.get("/:id", auth, controller.get);
router.patch("/:id", auth, upload.single("file"), controller.update);
router.post("/:id/submit", auth, controller.submit);
router.post("/:id/leader-approve", auth, controller.leaderApprove);
router.post("/:id/leader-reject", auth, controller.leaderReject);
router.post("/:id/approve", auth, controller.approve);
router.post("/:id/reject", auth, controller.reject);

export default router;
