import { auth } from "../lib/authMiddleware";
import { Router } from "express";
import { ContractController } from "./contract.controller";
import { ContractService } from "./contract.service";
import { ContractRepository } from "./contract.repo";
import { WageCapService } from "./wage-cap.service";
import { getPrisma } from "../lib/prisma";

const router = Router();
const repo = new ContractRepository(getPrisma());
const wageCapService = new WageCapService(getPrisma());
const service = new ContractService(repo, wageCapService);
const controller = new ContractController(service);


// 분석 엔드포인트 (구체적 경로 먼저)
router.get("/squad-salary-overview", auth, controller.getSquadSalaryOverview);
router.get("/expiring-with-value", auth, controller.getExpiringContractsWithValue);
router.get("/transfer-pnl", auth, controller.getTransferPnL);
router.get("/salary-benchmark", auth, controller.getSalaryBenchmark);
router.get("/prospect-summary", auth, controller.getProspectSummary);

// 선수별 계약 목록
router.get("/player/:playerId", auth, controller.getByPlayer);

// 계약 단건 (바이아웃 + 연장옵션 + 성과보너스 포함)
router.get("/:id", auth, controller.getById);

// 계약 생성 (ADMIN, FRONT_OFFICE)
router.post("/", auth, controller.create);

// 계약 상태 변경 ACTIVE→EXPIRED|TERMINATED (ADMIN)
router.patch("/:id/status", auth, controller.updateStatus);

// 바이아웃 조항 추가 (계약당 1개)
router.post("/:id/buyout", auth, controller.addBuyout);

// 연장 옵션 추가
router.post("/:id/extensions", auth, controller.addExtension);

// 성과 보너스 추가 (트리거 포함)
router.post("/:id/bonuses", auth, controller.addBonus);

export default router;
