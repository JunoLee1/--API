import { Router } from "express";
import multer from "multer";
import path from "path";
import { PlanReportController } from "./plan-report.controller";
import { PlanReportService } from "./plan-report.service";
import { PlanReportRepository } from "./plan-report.repo";
import { auth } from "../lib/authMiddleware";
import { getPrisma } from "../lib/prisma";

const router = Router();
const repo = new PlanReportRepository(getPrisma());
const service = new PlanReportService(repo);
const controller = new PlanReportController(service);

const upload = multer({
  storage: multer.diskStorage({
    destination: path.join(process.cwd(), "uploads"),
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// 파일 업로드 — /:id 보다 먼저 등록해야 'upload'가 id로 캡처되지 않음
router.post("/upload", auth, upload.single("file"), controller.uploadAttachment);

// 기안 목록 조회 (?templateType=&departmentId=&status=)
router.get("/", auth, controller.list);

// 기안 단건 조회
router.get("/:id", auth, controller.getById);

// 기안 작성
router.post("/", auth, controller.create);

// 기안 수정
router.put("/:id", auth, controller.update);

// 기안 상신
router.post("/:id/submit", auth, controller.submit);

// 기안 승인
router.post("/:id/approve", auth, controller.approve);

// 기안 반려
router.post("/:id/reject", auth, controller.reject);

// 결과 보고 제출
router.post("/:id/result", auth, controller.submitResult);

export default router;
