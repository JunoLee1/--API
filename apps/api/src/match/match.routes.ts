import { Router } from "express";
import passport from "passport";
import multer from "multer";
import path from "path";
import fs from "fs";
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

const statSheetUploadDir = path.join(process.cwd(), "uploads", "stat-sheets");
if (!fs.existsSync(statSheetUploadDir)) fs.mkdirSync(statSheetUploadDir, { recursive: true });
const statSheetStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, statSheetUploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const uploadStatSheet = multer({
  storage: statSheetStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("이미지 파일만 업로드할 수 있습니다."));
  },
});

// 경기 목록 조회 (?seasonId=&competitionType=)
router.get("/", auth, controller.getMatches);

// 경기 단건 조회 (선수 스탯 + 팀 스탯 포함)
router.get("/:id", auth, controller.getMatchById);

// 경기 생성 (ADMIN, FRONT_OFFICE)
router.post("/", auth, controller.createMatch);

// 경기 정보 수정 — 스코어 입력 포함 (ADMIN, FRONT_OFFICE)
router.patch("/:id", auth, controller.updateMatch);

// 스탯 시트 OCR 업로드 (ADMIN, COACHING_STAFF)
router.post("/:id/stat-sheet", auth, uploadStatSheet.single("image"), controller.uploadStatSheet);

// 선수별 매치 스탯 입력/수정 (ADMIN, COACHING_STAFF)
router.put("/:id/player-stats", auth, controller.upsertPlayerStats);

// 팀 매치 스탯 입력/수정 (ADMIN, COACHING_STAFF)
router.put("/:id/team-stats", auth, controller.upsertTeamStats);

const squadRepo = new MatchSquadRepository(getPrisma());
const squadService = new MatchSquadService(squadRepo, getPrisma());
const squadController = new MatchSquadController(squadService);

router.get("/:id/squad", auth, squadController.getSquad);
router.post("/:id/squad", auth, squadController.addPlayer);
router.delete("/:id/squad", auth, squadController.removePlayer);
router.post("/:id/squad/confirm", auth, squadController.confirmSquad);

// 슈팅 이벤트
router.get("/:id/shots",             auth, controller.getShotEvents);
router.post("/:id/shots",            auth, controller.createShotEvent);
router.delete("/:id/shots/:eventId", auth, controller.deleteShotEvent);

import { MatchLineupRepository } from "./match.lineup.repo";
import { MatchLineupService } from "./match.lineup.service";
import { MatchLineupController } from "./match.lineup.controller";

const lineupRepo = new MatchLineupRepository(getPrisma());
const lineupService = new MatchLineupService(lineupRepo);
const lineupController = new MatchLineupController(lineupService);

router.get("/:id/lineup", auth, lineupController.getLineup);
router.put("/:id/lineup", auth, lineupController.saveLineup);
router.post("/:id/lineup/confirm", auth, lineupController.confirmLineup);

export default router;
