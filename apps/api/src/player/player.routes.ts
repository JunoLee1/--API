import { Router } from "express";
import passport = require("passport");
import { PlayerController } from "./player.controller";
import { PlayerService } from "./player.service";
import { PlayerRepository } from "./player.repo";
import { getPrisma } from "../lib/prisma";

const router = Router();
const prisma = getPrisma();
const repo = new PlayerRepository(prisma);
const service = new PlayerService(repo, prisma);
const controller = new PlayerController(service);

const auth = passport.authenticate("accessToken", { session: false });

// 선수 프로필 생성 (ADMIN)
router.post("/", auth, controller.createPlayer);

// 선수 목록 조회
router.get("/", auth, controller.getPlayers);

// 선수 단건 조회
router.get("/:id", auth, controller.getPlayerById);

// 선수 프로필 수정
router.patch("/:id", auth, controller.updatePlayer);

// User ↔ Player 연결 (ADMIN)
router.patch("/:id/link-user", auth, controller.linkUser);

export default router;
