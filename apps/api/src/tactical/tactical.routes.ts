import { Router } from "express";
import passport from "passport";
import { TacticalController } from "./tactical.controller";
import { TacticalService } from "./tactical.service";
import { TacticalRepository } from "./tactical.repo";
import { getPrisma } from "../lib/prisma";

const router = Router();
const repo = new TacticalRepository(getPrisma());
const service = new TacticalService(repo);
const controller = new TacticalController(service);

const auth = passport.authenticate("accessToken", { session: false });

// 전술 분석 목록 (전체, 쿼리: matchId, phase)
router.get("/", auth, controller.list);
// 경기별 전술 분석 목록
router.get("/match/:matchId", auth, controller.getByMatch);
// 전술 분석 단건 (라인업 + 미디어 포함)
router.get("/:id", auth, controller.getById);
// 전술 분석 생성 (ADMIN, COACHING_STAFF)
router.post("/", auth, controller.create);
// 라인업 추가
router.post("/:id/lineup", auth, controller.addLineup);
// 미디어 추가
router.post("/:id/media", auth, controller.addMedia);
// 전술 분석 확정 (ADMIN, HEAD_COACH)
router.patch("/:id/confirm", auth, controller.confirm);

export default router;
