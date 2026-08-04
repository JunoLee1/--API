import { auth } from "../lib/authMiddleware";
import { Router } from "express";
import passport from "passport";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { AuthRepository } from "./auth.repo";
import { getPrisma } from "../lib/prisma";

const router = Router();
const repo = new AuthRepository(getPrisma());
const service = new AuthService(repo);
const controller = new AuthController(service, repo);

const refreshAuth = passport.authenticate("refreshToken", { session: false });

// 공개
router.post("/login", controller.login);

// refresh token으로 재발급
router.post("/refresh", refreshAuth, controller.refresh);

// 로그아웃
router.post("/logout", auth, controller.logout);

// 내 정보
router.get("/me", auth, controller.me);

// 언어 설정
router.patch("/me/language", auth, controller.updateLanguage);

// 유저 생성 (ADMIN 전용)
router.post("/users", auth, controller.createUser);

// 초대 (ADMIN 전용 - 생성/목록, 공개 - 조회/수락)
router.post("/invites", auth, controller.createInvite);
router.get("/invites", auth, controller.listInvites);
router.get("/invites/:token", controller.getInvite);
router.post("/invites/:token/accept", controller.acceptInvite);

// 로그인 이력 (ADMIN 전용)
router.get("/login-history", auth, controller.loginHistory);
router.get("/login-history/:userId", auth, controller.loginHistory);

export default router;
