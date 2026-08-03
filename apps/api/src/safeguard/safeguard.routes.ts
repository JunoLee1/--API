import { auth } from "../lib/authMiddleware";
import { Router } from 'express'
import { SafeguardController } from './safeguard.controller'
import { SafeguardService } from './safeguard.service'
import { SafeguardRepository } from './safeguard.repo'
import { NotificationRepository } from '../notification/notification.repo'
import { getPrisma } from '../lib/prisma'

const router = Router()
const prisma = getPrisma()
const repo = new SafeguardRepository(prisma)
const notifRepo = new NotificationRepository(prisma)
const service = new SafeguardService(repo, notifRepo)
const controller = new SafeguardController(service)


function adminOnly(req: any, res: any, next: any) {
  if (req.user?.role !== 'ADMIN') return res.status(403).json({ message: 'Forbidden' })
  next()
}

// 익명 제출 — 인증 불필요
router.post('/', controller.submit)

// 관리자 전용
router.get('/', auth, adminOnly, controller.getAll)
router.get('/:id', auth, adminOnly, controller.getById)
router.patch('/:id/status', auth, adminOnly, controller.updateStatus)

export default router
