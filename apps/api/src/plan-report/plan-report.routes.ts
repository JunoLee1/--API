import { Router, Request, Response, NextFunction } from 'express'
import multer from 'multer'
import path from 'path'
import { PlanReportController } from './plan-report.controller'
import { PlanReportService } from './plan-report.service'
import { PlanReportRepository } from './plan-report.repo'
import { NotificationRepository } from '../notification/notification.repo'
import { auth } from '../lib/authMiddleware'
import { AppError } from '../lib/appError'
import { canReadHR, canWriteHR } from '../lib/permissions'
import { getPrisma } from '../lib/prisma'

const router = Router()
const prisma = getPrisma()
const repo = new PlanReportRepository(prisma)
const notifRepo = new NotificationRepository(prisma)
const service = new PlanReportService(repo, notifRepo)
const controller = new PlanReportController(service, repo)

const upload = multer({
  storage: multer.diskStorage({
    destination: path.join(process.cwd(), 'uploads'),
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
})

const checkReadHR = (req: Request, _res: Response, next: NextFunction) => {
  const { role, frontOfficeRole } = req.user!
  if (!canReadHR(role, frontOfficeRole)) return next(new AppError(403, 'FORBIDDEN'))
  next()
}
const checkWriteHR = (req: Request, _res: Response, next: NextFunction) => {
  const { role, frontOfficeRole } = req.user!
  if (!canWriteHR(role, frontOfficeRole)) return next(new AppError(403, 'FORBIDDEN'))
  next()
}

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
router.get('/:id/hiring-items', auth, checkReadHR, controller.listHiringItems)
router.post('/:id/hiring-items', auth, checkWriteHR, controller.createHiringItem)
router.patch('/:id/hiring-items/:itemId', auth, checkWriteHR, controller.updateHiringItem)
router.delete('/:id/hiring-items/:itemId', auth, checkWriteHR, controller.deleteHiringItem)

export default router
