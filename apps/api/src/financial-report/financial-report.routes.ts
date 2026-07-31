import { Router } from "express";
import passport from "passport";
import multer from "multer";
import { FinancialReportController } from "./financial-report.controller";
import { FinancialReportService } from "./financial-report.service";
import { FinancialReportRepository } from "./financial-report.repo";
import { getPrisma } from "../lib/prisma";

const router = Router();
const repo = new FinancialReportRepository(getPrisma());
const service = new FinancialReportService(repo);
const controller = new FinancialReportController(service);

const auth = passport.authenticate("accessToken", { session: false });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 1 * 1024 * 1024 } });

router.post("/:seasonId", auth, controller.set);
router.post("/:seasonId/csv", auth, upload.single("file"), controller.setFromCSV);
router.get("/:seasonId", auth, controller.get);

export default router;
