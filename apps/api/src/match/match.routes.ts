import { Router } from "express";
import passport from "passport";
import { MatchController } from "./match.controller";
import { MatchService } from "./match.service";
import { MatchRepository } from "./match.repo";
import { MatchSquadRepository } from "./match.squad.repo";
import { MatchSquadService } from "./match.squad.service";
import { MatchSquadController } from "./match.squad.controller";
import { getPrisma } from "../lib/prisma";

const router = Router();
const repo = new MatchRepository(getPrisma());
const service = new MatchService(repo);
const controller = new MatchController(service);

const auth = passport.authenticate("accessToken", { session: false });

// 경기 목록 조회 (?seasonId=&competitionType=)
router.get("/", auth, controller.getMatches);

// 경기 단건 조회 (선수 스탯 + 팀 스탯 포함)
router.get("/:id", auth, controller.getMatchById);

// 경기 생성 (ADMIN, FRONT_OFFICE)
router.post("/", auth, controller.createMatch);

// 경기 정보 수정 — 스코어 입력 포함 (ADMIN, FRONT_OFFICE)
router.patch("/:id", auth, controller.updateMatch);

// 선수별 매치 스탯 입력/수정 (ADMIN, COACHING_STAFF)
router.put("/:id/player-stats", auth, controller.upsertPlayerStats);

// 팀 매치 스탯 입력/수정 (ADMIN, COACHING_STAFF)
router.put("/:id/team-stats", auth, controller.upsertTeamStats);

const squadRepo = new MatchSquadRepository(getPrisma());
const squadService = new MatchSquadService(squadRepo);
const squadController = new MatchSquadController(squadService);

router.get("/:id/squad", auth, squadController.getSquad);
router.post("/:id/squad", auth, squadController.addPlayer);
router.delete("/:id/squad", auth, squadController.removePlayer);
router.post("/:id/squad/confirm", auth, squadController.confirmSquad);

export default router;
