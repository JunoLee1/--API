import { Router } from "express";
import passport from "passport";
import { PlayerController } from "./player.controller";
import { PlayerService } from "./player.service";
import { PlayerRepository } from "./player.repo";
import { getPrisma } from "../lib/prisma";

const router = Router();
const repo = new PlayerRepository(getPrisma());
const service = new PlayerService(repo);
const controller = new PlayerController(service);

const auth = passport.authenticate("accessToken", { session: false });

// 선수 목록 조회 (?status=&position=&level=&nationalityId=)
router.get("/", auth, controller.getPlayers);

// 선수 단건 조회
router.get("/:id", auth, controller.getPlayerById);

// 선수 등록 (ADMIN, FRONT_OFFICE)
router.post("/", auth, controller.createPlayer);

// 선수 정보 수정 (ADMIN, FRONT_OFFICE)
router.patch("/:id", auth, controller.updatePlayer);

// 선수 상태 변경 (ADMIN)
router.patch("/:id/status", auth, controller.updatePlayerStatus);

// 선수 삭제 (ADMIN)
router.delete("/:id", auth, controller.deletePlayer);

export default router;
