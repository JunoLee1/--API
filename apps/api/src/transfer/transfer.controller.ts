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
      if (!["ADMIN", "FRONT_OFFICE"].includes(req.user!.role)) throw new AppError(403, "FORBIDDEN");
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
      if (req.user!.role !== "ADMIN") throw new AppError(403, "FORBIDDEN");
      res.status(200).json(
        await this.service.updateRecallStatus(Number(req.params["id"]), req.body, req.user!.id),
      );
    } catch (err) { next(err); }
  };
}
