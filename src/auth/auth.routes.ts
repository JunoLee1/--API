import { Router } from "express"
import AuthController  from './auth.controller';
import AuthService from "./auth.service"
import passport = require("passport");

const router = Router()
const service = new AuthService()
const controller = new AuthController(service)

//유저 생성
router.post("/", controller.signUp)

// 유저 로그인 
router.post("/login", controller.login)

// 관리자 정보 조회
router.get("/", 
    controller.findAdvisorById,
    passport.authenticate("accessToken")
)

// 관리자 전체 조회
router.get("/", controller.findAdvisors)

// 유저 정보 수정
router.patch("/me", controller.update)

// 유저 삭제 
router.delete("/")

export default router
