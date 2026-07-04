import { Router } from "express";
import AuthController from "./auth.controller";
import AuthService from "./auth.service";
import { AuthRepository } from "./auth.repo";
import { getPrisma } from "../lib/prisma";
import CountryService from "../country/country.service";
import CountryRepo from "../country/country.repo";
import { CountryApiClient } from "../externalAPI";
import passport = require("passport");
import { AppError } from "../lib/appError";

const router = Router();
const prisma = getPrisma();
const client = new CountryApiClient();
const repo = new AuthRepository(prisma);
const countryRepo = new CountryRepo(prisma);
const contryService = new CountryService(client, countryRepo);
const service = new AuthService(repo, contryService);
const controller = new AuthController(service);

//유저 생성
router.post("/signUp", controller.signUp);

// 유저 로그인
router.post("/login", controller.login.bind(controller));

// 관리자 정보 조회
router.get(
  "/:id",
  (req, res, next) => {
    passport.authenticate(
      "accessToken",
      { session: false },
      (err: any, user: any) => {
        if (err) return next(err);

        if (!user) {
          return next(new AppError(401, "UNAUTHORIZED"));
        }

        req.user = user;
        next();
      }
    )(req, res, next);
  },
  controller.findAdvisorById
);
// 관리자 전체 조회
router.get("/", passport.authenticate("accessToken"), controller.findAdvisors);

// 단일 관리자 정보 수정
router.patch(
  "/:id",
  passport.authenticate("accessToken"),
  controller.updatesAdvisor,
);

// 관리자 삭제
router.delete("/:id", passport.authenticate("accessToken"), controller.delete);

//다수 관리자 삭제
router.delete("/", passport.authenticate("accessToken"), controller.deleteMany);

export default router;
