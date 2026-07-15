import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import { InjuryService } from "./injury.service";

const MEDICAL_ROLES = ["ADMIN", "COACHING_STAFF"] as const;
type MedicalRole = (typeof MEDICAL_ROLES)[number];

export class InjuryController {
  constructor(private service: InjuryService) {}

  getStats = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, coachingRole } = req.user!;
      const isMedicalDirector =
        role === "COACHING_STAFF" && coachingRole === "MEDICAL_DIRECTOR";
      if (role !== "ADMIN" && !isMedicalDirector) throw new AppError(403, "FORBIDDEN");
      res.status(200).json(await this.service.getStats());
    } catch (err) { next(err); }
  };

  getByPlayer = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(200).json(await this.service.getByPlayer(String(req.params["playerId"])));
    } catch (err) { next(err); }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(200).json(await this.service.getById(Number(req.params["id"])));
    } catch (err) { next(err); }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!MEDICAL_ROLES.includes(req.user!.role as MedicalRole)) throw new AppError(403, "FORBIDDEN");
      res.status(201).json(await this.service.createInjury({ ...req.body, medicalStaffId: req.user!.id }));
    } catch (err) { next(err); }
  };

  updateStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!MEDICAL_ROLES.includes(req.user!.role as MedicalRole)) throw new AppError(403, "FORBIDDEN");
      res.status(200).json(await this.service.updateStatus(Number(req.params["id"]), req.body));
    } catch (err) { next(err); }
  };

  getReport = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const report = await this.service.getReport(Number(req.params["id"]));
      res.status(200).json(report ?? null);
    } catch (err) { next(err); }
  };

  saveReport = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!MEDICAL_ROLES.includes(req.user!.role as MedicalRole)) throw new AppError(403, "FORBIDDEN");
      res.status(200).json(
        await this.service.saveReport(Number(req.params["id"]), req.body, req.user!.id)
      );
    } catch (err) { next(err); }
  };
}
