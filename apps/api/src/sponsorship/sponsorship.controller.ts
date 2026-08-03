import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import type { SponsorshipService } from "./sponsorship.service";
import type { CreateSponsorshipDto, UpdateSponsorshipDto, SponsorshipListQuery } from "./dto/sponsorship.dto";

const canRead = (role: string) =>
  role === "ADMIN" || role === "FRONT_OFFICE";

const canWrite = (role: string, foRole: string | null | undefined) =>
  role === "ADMIN" || (role === "FRONT_OFFICE" && foRole === "FINANCE_MANAGER");

export class SponsorshipController {
  constructor(private service: SponsorshipService) {}

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!canRead(req.user!.role)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.list(req.query as SponsorshipListQuery));
    } catch (err) { next(err); }
  };

  get = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!canRead(req.user!.role)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.get(Number(req.params["id"])));
    } catch (err) { next(err); }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole, id: userId } = req.user!;
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      res.status(201).json(await this.service.create(req.body as CreateSponsorshipDto, userId));
    } catch (err) { next(err); }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.update(Number(req.params["id"]), req.body as UpdateSponsorshipDto));
    } catch (err) { next(err); }
  };

  getPayments = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.getPayments(Number(req.params["id"])));
    } catch (err) { next(err); }
  };

  markPaid = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      res.json(
        await this.service.markPaid(Number(req.params["id"]), Number(req.params["paymentId"])),
      );
    } catch (err) { next(err); }
  };
}
