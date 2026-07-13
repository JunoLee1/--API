import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import { EquipmentService } from "./equipment.service";

const canWrite = (role: string, frontOfficeRole: string | null | undefined): boolean =>
  role === "ADMIN" ||
  (role === "FRONT_OFFICE" &&
    (frontOfficeRole === "EQUIPMENT_MANAGER" || frontOfficeRole === "GM"));

const canRead = (role: string): boolean =>
  role === "ADMIN" || role === "FRONT_OFFICE" || role === "COACHING_STAFF";

export class EquipmentController {
  constructor(private service: EquipmentService) {}

  listItems = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!canRead(req.user!.role)) throw new AppError(403, "FORBIDDEN");
      res.status(200).json(await this.service.getAllItems());
    } catch (err) { next(err); }
  };

  getItem = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!canRead(req.user!.role)) throw new AppError(403, "FORBIDDEN");
      res.status(200).json(await this.service.getItemById(Number(req.params["id"])));
    } catch (err) { next(err); }
  };

  createItem = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      res.status(201).json(await this.service.createItem(req.body));
    } catch (err) { next(err); }
  };

  adjustQuantity = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      res.status(200).json(await this.service.adjustQuantity(Number(req.params["id"]), req.body));
    } catch (err) { next(err); }
  };

  addUnit = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      res.status(201).json(await this.service.addUnit(Number(req.params["id"])));
    } catch (err) { next(err); }
  };

  transitionUnit = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      res.status(200).json(await this.service.transitionUnitStatus(Number(req.params["unitId"]), req.body));
    } catch (err) { next(err); }
  };

  createAssignment = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      res.status(201).json(await this.service.createAssignment(req.body));
    } catch (err) { next(err); }
  };

  getUnreturnedByPlayer = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!canRead(req.user!.role)) throw new AppError(403, "FORBIDDEN");
      res.status(200).json(await this.service.getUnreturnedByPlayer(String(req.params["playerId"])));
    } catch (err) { next(err); }
  };

  returnAssignment = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      res.status(200).json(await this.service.returnAssignment(Number(req.params["assignmentId"])));
    } catch (err) { next(err); }
  };
}
