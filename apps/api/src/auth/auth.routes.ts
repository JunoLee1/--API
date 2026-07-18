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

const auth = passport.authenticate("accessToken", { session: false });
const refreshAuth = passport.authenticate("refreshToken", { session: false });

// 공개
router.post("/login", controller.login);

// refresh token으로 재발급
router.post("/refresh", refreshAuth, controller.refresh);

// 로그아웃
router.post("/logout", auth, controller.logout);

// 내 정보
router.get("/me", auth, controller.me);

// 유저 생성 (ADMIN 전용)
router.post("/users", auth, controller.createUser);

// 로그인 이력 (ADMIN 전용)
router.get("/login-history", auth, controller.loginHistory);
router.get("/login-history/:userId", auth, controller.loginHistory);

export default router;
