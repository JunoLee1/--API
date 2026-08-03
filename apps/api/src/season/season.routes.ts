import { auth } from "../lib/authMiddleware";
import { Router } from "express";
import { SeasonController } from "./season.controller";
import { SeasonService } from "./season.service";
import { SeasonRepository } from "./season.repo";
import { getPrisma } from "../lib/prisma";

const router = Router();
const prisma = getPrisma();
const repo = new SeasonRepository(prisma);
const service = new SeasonService(repo);
const controller = new SeasonController(service);


// 시즌 생성 (ADMIN)
router.post("/", auth, controller.createSeason);

// 시즌 목록 조회 (?status=UPCOMING|ACTIVE|CLOSED)
router.get("/", auth, controller.getSeasons);

// 현재 활성 시즌 조회 — /:id 보다 먼저 등록
router.get("/active", auth, controller.getActiveSeason);

// 활성 시즌 임금 KPI — /active/wage-cap-kpi 는 /:id 보다 먼저 등록
router.get("/active/wage-cap-kpi", auth, controller.getWageCapKPI);

// 시즌 단건 조회
router.get("/:id", auth, controller.getSeasonById);

// 시즌 활성화 UPCOMING → ACTIVE (ADMIN)
router.patch("/:id/activate", auth, controller.activateSeason);

// 시즌 종료 ACTIVE → CLOSED (ADMIN)
router.patch("/:id/close", auth, controller.closeSeason);

// 시즌 임금상한 설정 (ADMIN)
router.patch("/:id/wage-cap", auth, controller.setWageCap);

export default router;
