import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import { requireUser } from "../lib/authMiddleware";
import { AssetRequestService } from "./asset-request.service";
import { CreateAssetRequestDto, ListAssetRequestQuery, RejectDto } from "./dto/asset-request.dto";

export class AssetRequestController {
  constructor(private service: AssetRequestService) {}

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id: userId, role } = requireUser(req);
      const { filter, status } = req.query as ListAssetRequestQuery;
      const rows = await this.service.list(userId, role, filter, status);
      res.json(rows);
    } catch (err) {
      next(err);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      requireUser(req);
      const id = Number(req.params["id"]);
      if (!Number.isFinite(id)) throw new AppError(400, "INVALID_ID");
      const row = await this.service.getById(id);
      res.json(row);
    } catch (err) {
      next(err);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id: userId } = requireUser(req);
      const dto = req.body as CreateAssetRequestDto;
      const row = await this.service.create(dto, userId);
      res.status(201).json(row);
    } catch (err) {
      next(err);
    }
  };

  submit = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id: userId } = requireUser(req);
      const id = Number(req.params["id"]);
      const row = await this.service.submit(id, userId);
      res.json(row);
    } catch (err) {
      next(err);
    }
  };

  leaderApprove = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id: userId } = requireUser(req);
      const id = Number(req.params["id"]);
      const row = await this.service.leaderApprove(id, userId);
      res.json(row);
    } catch (err) {
      next(err);
    }
  };

  leaderReject = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id: userId } = requireUser(req);
      const id = Number(req.params["id"]);
      const { reason } = (req.body ?? {}) as RejectDto;
      const row = await this.service.leaderReject(id, userId, reason);
      res.json(row);
    } catch (err) {
      next(err);
    }
  };

  approve = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id: userId } = requireUser(req);
      const id = Number(req.params["id"]);
      const row = await this.service.approve(id, userId);
      res.json(row);
    } catch (err) {
      next(err);
    }
  };

  reject = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id: userId } = requireUser(req);
      const id = Number(req.params["id"]);
      const { reason } = (req.body ?? {}) as RejectDto;
      const row = await this.service.reject(id, userId, reason);
      res.json(row);
    } catch (err) {
      next(err);
    }
  };

  cancel = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id: userId } = requireUser(req);
      const id = Number(req.params["id"]);
      const row = await this.service.cancel(id, userId);
      res.json(row);
    } catch (err) {
      next(err);
    }
  };

  fulfill = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id: userId, role, frontOfficeRole } = requireUser(req);
      const id = Number(req.params["id"]);
      const row = await this.service.fulfill(id, userId, role, frontOfficeRole);
      res.json(row);
    } catch (err) {
      next(err);
    }
  };
}
