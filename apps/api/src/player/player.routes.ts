import { Router } from "express";
import passport from "passport";
import { PlayerController } from "./player.controller";
import { PlayerService } from "./player.service";
import { PlayerRepository } from "./player.repo";
import { getPrisma } from "../lib/prisma";
import { JerseyService } from "./jersey.service";
import { JerseyController } from "./jersey.controller";
import { JerseyRepository } from "./jersey.repo";
import { MarketValueRepository } from "./market-value.repo";

const router = Router();
const repo = new PlayerRepository(getPrisma());
const mvRepo = new MarketValueRepository(getPrisma());
const service = new PlayerService(repo, mvRepo);
const controller = new PlayerController(service);
const jerseyRepo = new JerseyRepository(getPrisma());
const jerseyService = new JerseyService(jerseyRepo);
const jerseyController = new JerseyController(jerseyService);

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

// 선수의 등번호 조회
router.get("/:id/jersey-numbers", auth, jerseyController.listByPlayer);

// 등번호 배정 (GM, ADMIN, FRONT_OFFICE)
router.post("/:id/jersey-numbers/assign", auth, jerseyController.assign);

// 등번호 해제 (GM, ADMIN, FRONT_OFFICE)
router.post("/:id/jersey-numbers/release", auth, jerseyController.release);

// 등번호 영구 결번 (GM, ADMIN)
router.post("/:id/jersey-numbers/retire", auth, jerseyController.retire);

// 결번 재활성화 (ADMIN only)
router.post("/:id/jersey-numbers/reactivate", auth, jerseyController.reactivate);

// 시장 가치 이력 조회 (GM, TD, ADMIN)
router.get("/:id/market-value/history", auth, controller.getMarketValueHistory);

// 시장 가치 수동 업데이트 (GM, TD, ADMIN)
router.patch("/:id/market-value", auth, controller.updateMarketValue);

export default router;
