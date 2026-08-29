import { Router } from "express";
import { auth } from "../lib/authMiddleware";
import { getPrisma } from "../lib/prisma";
import { BudgetPlanRequestService } from "./plan-request.service";
import { BudgetPlanRequestController } from "./plan-request.controller";
import { KnapsackService } from "../budget/knapsack.service";

const router = Router();
const service = new BudgetPlanRequestService(getPrisma(), new KnapsackService());
const controller = new BudgetPlanRequestController(service);

// FinanceManager: DRAFT → AWAITING_REVIEW, 팀장·부서장 신청 창 개방 (14일)
router.post("/financial-reports/:seasonId/open-review", auth, controller.openReview);

// 팀장/부서장: 편성 신청서 제출 (스코프 자동 판정)
router.post("/financial-reports/:seasonId/plan-requests", auth, controller.submit);

// FinanceManager: 심사 신청 현황 조회
router.get("/financial-reports/:seasonId/plan-requests", auth, controller.list);

// FinanceManager: knapsack 실행 (심사 마감 or 전원 신청 완료 후)
router.post("/financial-reports/:seasonId/execute-knapsack", auth, controller.executeKnapsack);

export default router;
