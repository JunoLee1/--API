import { Router } from "express";
import { auth } from "../lib/authMiddleware";
import { getPrisma } from "../lib/prisma";
import { OpsReportRepository } from "./ops-report.repo";
import { OpsReportService } from "./ops-report.service";
import { OpsReportController } from "./ops-report.controller";

const router = Router();
const repo = new OpsReportRepository(getPrisma());
const service = new OpsReportService(repo, getPrisma());
const controller = new OpsReportController(service);

router.get("/ops/kpi",       auth, controller.getOpsKpi);
router.get("/ops/annual",    auth, controller.getAnnualOps);
router.get("/budget/kpi",    auth, controller.getBudgetKpi);
router.get("/budget/annual", auth, controller.getAnnualBudget);
router.get("/drill/notice-unread", auth, controller.getDrillNoticeUnread);
router.get("/drill/attendance",    auth, controller.getDrillAttendance);

export default router;
