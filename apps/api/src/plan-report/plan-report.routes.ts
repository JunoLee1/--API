import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import { PlanReportController } from './plan-report.controller'
import { PlanReportService } from './plan-report.service'
import { PlanReportRepository } from './plan-report.repo'
import { auth } from '../lib/authMiddleware'
import { getPrisma } from '../lib/prisma'

const router = Router()
const prisma = getPrisma()
const repo = new PlanReportRepository(prisma)
const service = new PlanReportService(repo)
const controller = new PlanReportController(service)

const upload = multer({
  storage: multer.diskStorage({
    destination: path.join(process.cwd(), 'uploads'),
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
})

router.get('/', auth, controller.list)
router.get('/approved-hr', auth, controller.listApprovedHr)
router.get('/:id', auth, controller.getById)
router.post('/', auth, controller.create)
router.put('/:id', auth, controller.update)
router.post('/:id/submit', auth, controller.submit)
router.post('/:id/approve', auth, controller.approve)
router.post('/:id/reject', auth, controller.reject)
router.post('/:id/result', auth, controller.submitResult)
router.post('/upload', auth, upload.single('file'), controller.uploadAttachment)

export default router
