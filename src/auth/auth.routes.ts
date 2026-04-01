import { Router } from "express"
import AuthController  from './auth.controller';
import AuthService from "./auth.service"

const router = Router()
const service = new AuthService()
const controller = new AuthController(service)

//유저 생성
router.post("/", controller.create)

// 관리자 정보 조회
router.get("/", controller.accessAdvisor)

// 관리자 전체 조회
router.get("/", controller.accessAdvisors)

// 유저 정보 수정
router.patch("/me", controller.update)

// 유저 삭제 
router.delete("/")

export default router
