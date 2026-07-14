import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import { HospitalService } from "./hospital.service";

export class HospitalController {
  constructor(private service: HospitalService) {}

  list = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(200).json(await this.service.list());
    } catch (err) {
      next(err);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.user!.role !== "ADMIN") throw new AppError(403, "FORBIDDEN");
      res.status(201).json(await this.service.create(req.body));
    } catch (err) {
      next(err);
    }
  };
}
