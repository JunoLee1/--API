import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import { ClubService } from "./club.service";

export class ClubController {
  constructor(private service: ClubService) {}

  getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.getAll(req.user!.role, req.user!.clubId));
    } catch (err) { next(err); }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.getById(Number(req.params["id"])));
    } catch (err) { next(err); }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.user!.role !== "SUPER_ADMIN") throw new AppError(403, "FORBIDDEN");
      const { name } = req.body as { name?: unknown };
      if (typeof name !== "string" || !name.trim()) {
        throw new AppError(400, "INVALID_CLUB_NAME");
      }
      res.status(201).json(await this.service.create({ name }));
    } catch (err) { next(err); }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const role = req.user!.role;
      if (role !== "SUPER_ADMIN" && role !== "ADMIN") throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.update(Number(req.params["id"]), req.body));
    } catch (err) { next(err); }
  };
}
