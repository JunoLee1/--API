import { Router } from "express";
import { auth } from "../lib/authMiddleware";
import { requireGuardian, requireGuardianChild } from "./guardian.middleware";
import { GuardianController } from "./guardian.controller";
import { GuardianService } from "./guardian.service";
import { GuardianRepository } from "./guardian.repo";
import { getPrisma } from "../lib/prisma";

const router = Router();
const repo = new GuardianRepository(getPrisma());
const service = new GuardianService(repo);
const controller = new GuardianController(service);

// 초대 코드 발급 — auth만 (ADMIN/FRONT_OFFICE/GM, controller에서 체크)
router.post("/invite-code", auth, controller.issueInviteCode);

// 자녀 연동 — auth + requireGuardian
router.post("/link/search", auth, requireGuardian, controller.linkBySearch);
router.post("/link/code", auth, requireGuardian, controller.linkByCode);

// 자녀 목록 — auth + requireGuardian
router.get("/me/children", auth, requireGuardian, controller.getChildren);

// 특정 자녀 대시보드 — auth + requireGuardian + requireGuardianChild (소유권 검증)
router.get("/me/children/:playerId/dashboard", auth, requireGuardian, requireGuardianChild, controller.getDashboard);

export default router;
