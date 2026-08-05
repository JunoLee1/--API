import type { Request, Response, NextFunction } from "express";
import { AppError } from "../../lib/appError";
import { isAdminLike } from "../../lib/permissions";
import type { RunService } from "./run.service";
import type { CreateRunDto } from "./dto/run.dto";

const canWrite = (role: string, foRole: string | null | undefined) =>
  isAdminLike(role) || (role === "FRONT_OFFICE" && foRole === "FINANCE_MANAGER");

const canConfirm = (role: string) => isAdminLike(role);

export class RunController {
  constructor(private service: RunService) {}

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.list(Number(req.params["id"])));
    } catch (err) { next(err); }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      res.status(201).json(
        await this.service.createRun(Number(req.params["id"]), req.body as CreateRunDto),
      );
    } catch (err) { next(err); }
  };

  confirm = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, id: userId } = req.user!;
      if (!canConfirm(role)) throw new AppError(403, "FORBIDDEN");
      res.json(
        await this.service.confirmRun(
          Number(req.params["id"]),
          Number(req.params["runId"]),
          userId,
        ),
      );
    } catch (err) { next(err); }
  };

  secondApprove = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, id: userId } = req.user!;
      if (!canConfirm(role)) throw new AppError(403, "FORBIDDEN");
      res.json(
        await this.service.secondApproveRun(
          Number(req.params["id"]),
          Number(req.params["runId"]),
          userId,
        ),
      );
    } catch (err) { next(err); }
  };
}
