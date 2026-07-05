import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import { ContractService } from "./contract.service";

const WRITE_ROLES = ["ADMIN", "FRONT_OFFICE"] as const;
type WriteRole = (typeof WRITE_ROLES)[number];

export class ContractController {
  constructor(private service: ContractService) {}

  getByPlayer = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(200).json(await this.service.getContractsByPlayer(String(req.params["playerId"])));
    } catch (err) {
      next(err);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(200).json(await this.service.getContractById(Number(req.params["id"])));
    } catch (err) {
      next(err);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!WRITE_ROLES.includes(req.user!.role as WriteRole)) throw new AppError(403, "FORBIDDEN");
      res.status(201).json(await this.service.createContract(req.body));
    } catch (err) {
      next(err);
    }
  };

  updateStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.user!.role !== "ADMIN") throw new AppError(403, "FORBIDDEN");
      res.status(200).json(await this.service.updateStatus(Number(req.params["id"]), req.body));
    } catch (err) {
      next(err);
    }
  };

  addBuyout = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!WRITE_ROLES.includes(req.user!.role as WriteRole)) throw new AppError(403, "FORBIDDEN");
      res.status(201).json(await this.service.addBuyout(Number(req.params["id"]), req.body));
    } catch (err) {
      next(err);
    }
  };

  addExtension = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!WRITE_ROLES.includes(req.user!.role as WriteRole)) throw new AppError(403, "FORBIDDEN");
      res.status(201).json(await this.service.addExtension(Number(req.params["id"]), req.body));
    } catch (err) {
      next(err);
    }
  };

  addBonus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!WRITE_ROLES.includes(req.user!.role as WriteRole)) throw new AppError(403, "FORBIDDEN");
      res.status(201).json(await this.service.addBonus(Number(req.params["id"]), req.body));
    } catch (err) {
      next(err);
    }
  };
}
