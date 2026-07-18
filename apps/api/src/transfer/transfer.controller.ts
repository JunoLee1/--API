import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import { TransferService } from "./transfer.service";
import { RecallStatus } from "../generated/enums";

export class TransferController {
  constructor(private service: TransferService) {}

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

  createTransfer = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (role !== "ADMIN" && role !== "FRONT_OFFICE") throw new AppError(403, "FORBIDDEN");
      if (role === "FRONT_OFFICE") {
        const allowed = ["GM", "TD", "CONTRACT_MANAGER"];
        if (!frontOfficeRole || !allowed.includes(frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      }
      res.status(201).json(await this.service.createTransfer(req.body));
    } catch (err) { next(err); }
  };

  getRecalls = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const status = req.query["status"] as RecallStatus | undefined;
      res.status(200).json(await this.service.getRecalls(status));
    } catch (err) { next(err); }
  };

  createRecall = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(201).json(await this.service.createRecall(req.body, req.user!.id));
    } catch (err) { next(err); }
  };

  updateRecallStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      const isGM = role === "FRONT_OFFICE" && frontOfficeRole === "GM";
      if (!isGM) throw new AppError(403, "FORBIDDEN");
      res.status(200).json(
        await this.service.updateRecallStatus(Number(req.params["id"]), req.body, req.user!.id),
      );
    } catch (err) { next(err); }
  };

  exportLoanIn = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      const isAdmin = role === "ADMIN";
      const isFrontOffice = role === "FRONT_OFFICE" && ["GM", "TD"].includes(frontOfficeRole ?? "");
      if (!isAdmin && !isFrontOffice) throw new AppError(403, "FORBIDDEN");
      res.status(200).json(await this.service.exportLoanIn(Number(req.params["id"])));
    } catch (err) { next(err); }
  };
}
