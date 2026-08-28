import { Router } from 'express'
import type { Request, Response, NextFunction } from 'express'
import { auth } from '../lib/authMiddleware'
import { canWriteHR } from '../lib/permissions'
import { getPrisma } from '../lib/prisma'
import { HiringSurveyRepository } from './hiring-survey.repo'
import { HiringSurveyService } from './hiring-survey.service'
import { HiringSurveyController } from './hiring-survey.controller'
import { PlanReportRepository } from '../plan-report/plan-report.repo'
import { NotificationRepository } from '../notification/notification.repo'

function requireHR(req: Request, res: Response, next: NextFunction) {
  const user = req.user as any
  if (!user) return res.status(401).json({ error: "UNAUTHENTICATED" })
  if (!canWriteHR(user.role, user.frontOfficeRole ?? null)) return res.status(403).json({ error: "FORBIDDEN" })
  next()
}

const router = Router()
const prisma = getPrisma()
const repo = new HiringSurveyRepository(prisma)
const planReportRepo = new PlanReportRepository(prisma)
const notifRepo = new NotificationRepository(prisma)
const service = new HiringSurveyService(repo, planReportRepo, notifRepo)
const controller = new HiringSurveyController(service)

router.get('/', auth, controller.list)
router.post('/', auth, requireHR, controller.create)
router.get('/:id/participation-rate', auth, requireHR, controller.getParticipationRate)
router.get('/:id', auth, controller.get)

// Response workflow (issues #367/#368) — leader authorization is enforced by the
// service via `UserDepartment.role='LEADER'` for the target department, so no
// `requireHR` gate here.
router.post('/:id/respond', auth, controller.createResponse)
router.patch('/:id/responses/:responseId', auth, controller.updateResponse)
router.post('/:id/responses/:responseId/submit', auth, controller.submitResponse)
router.post('/:id/responses/:responseId/approve', auth, controller.approveResponse)
router.post('/:id/responses/:responseId/reject', auth, controller.rejectResponse)

router.post('/:id/close', auth, requireHR, controller.close)
router.patch('/:id', auth, requireHR, controller.updateDraft)
router.post('/:id/open', auth, requireHR, controller.open)
router.delete('/:id', auth, requireHR, controller.deleteDraft)

export default router
