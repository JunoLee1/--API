import { auth } from "../lib/authMiddleware";
import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { TacticalController } from "./tactical.controller";
import { TacticalService } from "./tactical.service";
import { TacticalRepository } from "./tactical.repo";
import { NotificationRepository } from "../notification/notification.repo";
import { getPrisma } from "../lib/prisma";

const router = Router();
const repo = new TacticalRepository(getPrisma());
const notifRepo = new NotificationRepository(getPrisma());
const service = new TacticalService(repo, notifRepo);
const controller = new TacticalController(service);


const uploadDir = path.join(process.cwd(), "uploads", "tactical-media");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/")) {
      cb(null, true);
    } else {
      cb(new Error("이미지 또는 동영상 파일만 업로드할 수 있습니다."));
    }
  },
});

// 전술 분석 목록 (전체, 쿼리: matchId, phase)
router.get("/", auth, controller.list);
// 경기별 전술 분석 목록
router.get("/match/:matchId", auth, controller.getByMatch);
// 전술 분석 단건 (라인업 + 미디어 포함)
router.get("/:id", auth, controller.getById);
// 전술 분석 생성 (ADMIN, COACHING_STAFF)
router.post("/", auth, controller.create);
// 라인업 추가
router.post("/:id/lineup", auth, controller.addLineup);
// 미디어 추가 (이미지/동영상 멀티파일)
router.post("/:id/media", auth, upload.array("files", 10), controller.addMedia);
// 전술 분석 수정 (ADMIN, COACHING_STAFF, TACTICAL_ANALYST)
router.patch("/:id", auth, controller.update);
// 전술 분석 확정 (ADMIN, HEAD_COACH)
router.patch("/:id/confirm", auth, controller.confirm);

export default router;
