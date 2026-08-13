import type { Request, Response, NextFunction } from 'express'
import type { PlanReportService } from './plan-report.service'
import { PlanReportRepository } from './plan-report.repo'
import path from 'path'

export class PlanReportController {
  constructor(
    private service: PlanReportService,
    private repo: PlanReportRepository,
  ) {}

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.list(req.query as any))
    } catch (e) { next(e) }
  }

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.getById(Number(req.params.id)))
    } catch (e) { next(e) }
  }

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(201).json(await this.service.create(req.body, req.user!.id))
    } catch (e) { next(e) }
  }

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.update(Number(req.params.id), req.body))
    } catch (e) { next(e) }
  }

  submit = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.submit(Number(req.params.id), req.user!.id))
    } catch (e) { next(e) }
  }

  approve = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.approve(Number(req.params.id), req.user!.id, req.user!.role))
    } catch (e) { next(e) }
  }

  reject = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.reject(Number(req.params.id), req.user!.id, req.user!.role, req.body.reason))
    } catch (e) { next(e) }
  }

  listApprovedHr = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.listApprovedHrReports())
    } catch (e) { next(e) }
  }

  submitResult = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.submitResult(Number(req.params.id), req.user!.id, req.body.resultContent))
    } catch (e) { next(e) }
  }

  uploadAttachment = (req: Request, res: Response) => {
    if (!req.file) return res.status(400).json({ error: 'NO_FILE_UPLOADED' })
    const relativePath = `/uploads/${path.basename(req.file.path)}`
    res.json({ url: relativePath })
  }

  listHiringItems = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const items = await this.repo.listHiringPlanItems(Number(req.params.id))
      res.json(items)
    } catch (e) { next(e) }
  }

  createHiringItem = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const item = await this.repo.createHiringPlanItem(Number(req.params.id), req.body)
      res.status(201).json(item)
    } catch (e) { next(e) }
  }

  updateHiringItem = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const item = await this.repo.updateHiringPlanItem(
        Number(req.params.itemId),
        Number(req.params.id),
        req.body
      )
      res.json(item)
    } catch (e) { next(e) }
  }

  deleteHiringItem = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.repo.deleteHiringPlanItem(Number(req.params.itemId), Number(req.params.id))
      res.status(204).send()
    } catch (e) { next(e) }
  }
}
