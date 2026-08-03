import type { Request, Response, NextFunction } from "express";
import { AppError } from "../../lib/appError";
import type { AllowanceService } from "./allowance.service";
import type { CreateAllowanceDto, UpdateAllowanceDto } from "./dto/allowance.dto";

const canWrite = (role: string, foRole: string | null | undefined) =>
  role === "ADMIN" || (role === "FRONT_OFFICE" && foRole === "FINANCE_MANAGER");

export class AllowanceController {
  constructor(private service: AllowanceService) {}

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.list(Number(req.params["id"])));
    } catch (err) { next(err); }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      res.status(201).json(
        await this.service.create(Number(req.params["id"]), req.body as CreateAllowanceDto),
      );
    } catch (err) { next(err); }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      res.json(
        await this.service.update(
          Number(req.params["id"]),
          Number(req.params["aid"]),
          req.body as UpdateAllowanceDto,
        ),
      );
    } catch (err) { next(err); }
  };

  remove = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      await this.service.remove(Number(req.params["id"]), Number(req.params["aid"]));
      res.status(204).send();
    } catch (err) { next(err); }
  };
}
