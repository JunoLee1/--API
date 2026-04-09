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
router.get("/:id", 
    controller.findAdvisorById,
    passport.authenticate("accessToken")
)

// 관리자 전체 조회
router.get("/",
    controller.findAdvisors,
    passport.authenticate("accessToken")
),


// 단일 관리자 정보 수정
router.patch("/me",
    controller.updatesAdvisor,
    passport.authenticate("accessToken")
)
// 다수 관리자 상태 변경
router.patch("/me",
    controller.updateAdvisorsStatus,
    passport.authenticate("accessToken")
)

// 관리자 삭제
router.delete("/:id",
    controller.delete,
    passport.authenticate("accessToken")
)

//다수 관리자 삭제 
router.delete("/",
    controller.deleteMany,
    passport.authenticate("accessToken")
)

export default router
