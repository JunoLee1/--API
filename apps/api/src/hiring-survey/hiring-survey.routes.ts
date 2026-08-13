import { Router } from 'express'
import { auth } from '../lib/authMiddleware'
import { getPrisma } from '../lib/prisma'
import { HiringSurveyRepository } from './hiring-survey.repo'
import { HiringSurveyService } from './hiring-survey.service'
import { HiringSurveyController } from './hiring-survey.controller'
import { PlanReportRepository } from '../plan-report/plan-report.repo'
import { NotificationRepository } from '../notification/notification.repo'

const router = Router()
const prisma = getPrisma()
const repo = new HiringSurveyRepository(prisma)
const planReportRepo = new PlanReportRepository(prisma)
const notifRepo = new NotificationRepository(prisma)
const service = new HiringSurveyService(repo, planReportRepo, notifRepo)
const controller = new HiringSurveyController(service)

router.get('/', auth, controller.list)
router.post('/', auth, controller.create)
router.get('/:id', auth, controller.get)
router.post('/:id/respond', auth, controller.submitResponse)
router.post('/:id/close', auth, controller.close)

export default router
