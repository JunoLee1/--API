import type { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import type { YouthRegistrationService } from "./youth-registration.service";
import type { CreateYouthRegistrationDto, RejectYouthRegistrationDto, YouthRegistrationListQuery } from "./dto/youth-registration.dto";

export class YouthRegistrationController {
  constructor(private service: YouthRegistrationService) {}

  getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query: YouthRegistrationListQuery = {};
      if (req.query["teamId"]) query.teamId = Number(req.query["teamId"]);
      if (req.query["status"]) query.status = req.query["status"] as "PENDING" | "GUARDIAN_APPROVED" | "CONTRACTED" | "REJECTED";
      const data = await this.service.getAll(query);
      res.json(data);
    } catch (e) { next(e); }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.getById(Number(req.params["id"]));
      res.json(data);
    } catch (e) { next(e); }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { playerName, birthDate, preferredJerseyNumber, teamId, guardianEmail } = req.body;
      if (!playerName || !birthDate || !teamId || !guardianEmail) throw new AppError(400, "MISSING_REQUIRED_FIELDS");
      const dto: CreateYouthRegistrationDto = { playerName, birthDate, preferredJerseyNumber, teamId: Number(teamId), guardianEmail };
      const data = await this.service.create(dto, (req.user as any).id);
      res.status(201).json(data);
    } catch (e) { next(e); }
  };

  guardianApprove = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.guardianApprove(Number(req.params["id"]), (req.user as any).id);
      res.json(data);
    } catch (e) { next(e); }
  };

  reject = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { rejectionReason } = req.body;
      if (!rejectionReason) throw new AppError(400, "MISSING_REQUIRED_FIELDS");
      const dto: RejectYouthRegistrationDto = { rejectionReason };
      const data = await this.service.reject(Number(req.params["id"]), dto);
      res.json(data);
    } catch (e) { next(e); }
  };

  contract = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { nationalityId } = req.body;
      if (!nationalityId) throw new AppError(400, "NATIONALITY_REQUIRED");
      const data = await this.service.contract(Number(req.params["id"]), (req.user as any).id, Number(nationalityId));
      res.status(201).json(data);
    } catch (e) { next(e); }
  };
}
