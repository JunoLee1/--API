import { Request, Response, NextFunction } from "express";
import { AcquisitionSurveyService } from "./acquisition-survey.service";

export class AcquisitionSurveyController {
  constructor(private service: AcquisitionSurveyService) {}

  list = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.getAll());
    } catch (e) {
      next(e);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.getById(Number(req.params.id)));
    } catch (e) {
      next(e);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const survey = await this.service.create(req.body, req.user!.id);
      res.status(201).json(survey);
    } catch (e) {
      next(e);
    }
  };

  close = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.close(Number(req.params.id)));
    } catch (e) {
      next(e);
    }
  };

  submitResponse = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.submitResponse(
        Number(req.params.id),
        req.user!.id,
        req.body.items ?? [],
      );
      res.status(201).json(result);
    } catch (e) {
      next(e);
    }
  };

  getResponses = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.getResponses(Number(req.params.id)));
    } catch (e) {
      next(e);
    }
  };
}
