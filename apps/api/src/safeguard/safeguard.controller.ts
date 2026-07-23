import type { Request, Response, NextFunction } from 'express'
import type { SafeguardService } from './safeguard.service'
import { validateCreateSafeguardReport, validateUpdateSafeguardStatus } from './dto/safeguard.dto'

export class SafeguardController {
  constructor(private service: SafeguardService) {}

  submit = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto = validateCreateSafeguardReport(req.body)
      res.status(201).json(await this.service.submit(dto))
    } catch (e) { next(e) }
  }

  getAll = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.getAll())
    } catch (e) { next(e) }
  }

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.getById(Number(req.params.id)))
    } catch (e) { next(e) }
  }

  updateStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto = validateUpdateSafeguardStatus(req.body)
      res.json(await this.service.updateStatus(Number(req.params.id), dto))
    } catch (e) { next(e) }
  }
}
