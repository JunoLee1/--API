import type { Request, Response, NextFunction } from "express";
import { AppError } from "../../lib/appError";
import type { SalaryService } from "./salary.service";
import type { CreateSalaryDto, UpdateSalaryDto, SalaryListQuery } from "./dto/salary.dto";

const canWrite = (role: string, foRole: string | null | undefined) =>
  role === "ADMIN" || (role === "FRONT_OFFICE" && foRole === "FINANCE_MANAGER");

export class SalaryController {
  constructor(private service: SalaryService) {}

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.list(req.query as SalaryListQuery));
    } catch (err) { next(err); }
  };

  get = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.get(Number(req.params["id"])));
    } catch (err) { next(err); }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      res.status(201).json(await this.service.create(req.body as CreateSalaryDto));
    } catch (err) { next(err); }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.update(Number(req.params["id"]), req.body as UpdateSalaryDto));
    } catch (err) { next(err); }
  };
}
