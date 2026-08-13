import type { Request, Response } from 'express'
import { HiringSurveyService } from './hiring-survey.service'

export class HiringSurveyController {
  constructor(private service: HiringSurveyService) {}

  list = async (_req: Request, res: Response) => {
    const surveys = await this.service.list()
    res.json(surveys)
  }

  get = async (req: Request, res: Response) => {
    const survey = await this.service.getById(Number(req.params.id))
    res.json(survey)
  }

  create = async (req: Request, res: Response) => {
    const userId = (req as any).user.id
    const survey = await this.service.create(req.body, userId)
    res.status(201).json(survey)
  }

  submitResponse = async (req: Request, res: Response) => {
    const userId = (req as any).user.id
    const result = await this.service.submitResponse(Number(req.params.id), userId, req.body)
    res.json(result)
  }

  close = async (req: Request, res: Response) => {
    const userId = (req as any).user.id
    const planReport = await this.service.close(Number(req.params.id), userId)
    res.json(planReport)
  }
}
