import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import { isAdminLike } from "../lib/permissions";
import { requireUser } from "../lib/authMiddleware";
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
      const user = requireUser(req);
      if (!(WRITE_ROLES as readonly string[]).includes(user.role)) throw new AppError(403, "FORBIDDEN");
      res.status(201).json(await this.service.createContract(req.body, user.id));
    } catch (err) {
      next(err);
    }
  };

  updateStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = requireUser(req);
      if (!isAdminLike(user.role)) throw new AppError(403, "FORBIDDEN");
      res.status(200).json(await this.service.updateStatus(Number(req.params["id"]), req.body, user.id));
    } catch (err) {
      next(err);
    }
  };

  addBuyout = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = requireUser(req);
      if (!(WRITE_ROLES as readonly string[]).includes(user.role)) throw new AppError(403, "FORBIDDEN");
      res.status(201).json(await this.service.addBuyout(Number(req.params["id"]), req.body, user.id));
    } catch (err) {
      next(err);
    }
  };

  addExtension = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = requireUser(req);
      if (!(WRITE_ROLES as readonly string[]).includes(user.role)) throw new AppError(403, "FORBIDDEN");
      res.status(201).json(await this.service.addExtension(Number(req.params["id"]), req.body, user.id));
    } catch (err) {
      next(err);
    }
  };

  addBonus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = requireUser(req);
      if (!(WRITE_ROLES as readonly string[]).includes(user.role)) throw new AppError(403, "FORBIDDEN");
      res.status(201).json(await this.service.addBonus(Number(req.params["id"]), req.body, user.id));
    } catch (err) {
      next(err);
    }
  };

  getSquadSalaryOverview = async (req: Request, res: Response, next: NextFunction) => {
    try {
      requireUser(req);
      res.status(200).json(await this.service.getSquadSalaryOverview());
    } catch (err) {
      next(err);
    }
  };

  getExpiringContractsWithValue = async (req: Request, res: Response, next: NextFunction) => {
    try {
      requireUser(req);
      const days = req.query["days"] ? Number(req.query["days"]) : undefined;
      res.status(200).json(await this.service.getExpiringContractsWithValue(days));
    } catch (err) {
      next(err);
    }
  };

  getTransferPnL = async (req: Request, res: Response, next: NextFunction) => {
    try {
      requireUser(req);
      res.status(200).json(await this.service.getTransferPnL());
    } catch (err) {
      next(err);
    }
  };

  getSalaryBenchmark = async (req: Request, res: Response, next: NextFunction) => {
    try {
      requireUser(req);
      res.status(200).json(await this.service.getSalaryBenchmark());
    } catch (err) {
      next(err);
    }
  };

  getProspectSummary = async (req: Request, res: Response, next: NextFunction) => {
    try {
      requireUser(req);
      res.status(200).json(await this.service.getProspectSummary());
    } catch (err) {
      next(err);
    }
  };
}
