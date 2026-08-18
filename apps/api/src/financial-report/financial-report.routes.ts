import { auth } from "../lib/authMiddleware";
import { Router } from "express";
import multer from "multer";
import { FinancialReportController } from "./financial-report.controller";
import { FinancialReportService } from "./financial-report.service";
import { FinancialReportRepository } from "./financial-report.repo";
import { KnapsackService } from "../budget/knapsack.service";
import { getPrisma } from "../lib/prisma";

const router = Router();
const repo = new FinancialReportRepository(getPrisma());
const knapsack = new KnapsackService();
const service = new FinancialReportService(repo, knapsack);
const controller = new FinancialReportController(service);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 1 * 1024 * 1024 } });

router.post("/:seasonId",                   auth, controller.set);
router.post("/:seasonId/from-prev-season",      auth, controller.setFromPrevSeason);
router.post("/:seasonId/revenue/auto-fill",     auth, controller.autoFillRevenue);
router.put("/:seasonId/revenue",            auth, controller.setBreakdown);
router.post("/:seasonId/csv",               auth, upload.single("file"), controller.setFromCSV);
router.get("/:seasonId/pl",                 auth, controller.getPnL);
router.get("/:seasonId/with-ledger",        auth, controller.getWithLedger);
router.get("/:seasonId",                    auth, controller.get);
router.get("/:seasonId/budget",             auth, controller.getBudgetPlan);
router.put("/:seasonId/budget",             auth, controller.upsertBudgetPlan);
router.post("/:seasonId/budget/optimize",   auth, controller.optimize);
router.post("/:seasonId/budget/override",   auth, controller.addOverride);
router.post("/:seasonId/budget/auto-generate", auth, controller.autoGenerateBudget);

export default router;
