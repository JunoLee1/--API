import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import { SeasonService } from "./season.service";
import { SetWageCapDto } from "./dto/season.dto";

export class SeasonController {
  constructor(private service: SeasonService) {}

  createSeason = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.user!.role !== "ADMIN") throw new AppError(403, "FORBIDDEN");
      const season = await this.service.createSeason(req.body);
      res.status(201).json(season);
    } catch (err) {
      next(err);
    }
  };

  getSeasons = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const status = req.query["status"] as string | undefined;
      const seasons = await this.service.getSeasons(status);
      res.status(200).json(seasons);
    } catch (err) {
      next(err);
    }
  };

  getActiveSeason = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const season = await this.service.getActiveSeason();
      res.status(200).json(season);
    } catch (err) {
      next(err);
    }
  };

  getSeasonById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params["id"]);
      const season = await this.service.getSeasonById(id);
      res.status(200).json(season);
    } catch (err) {
      next(err);
    }
  };

  activateSeason = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.user!.role !== "ADMIN") throw new AppError(403, "FORBIDDEN");
      const id = Number(req.params["id"]);
      const season = await this.service.activateSeason(id);
      res.status(200).json(season);
    } catch (err) {
      next(err);
    }
  };

  closeSeason = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.user!.role !== "ADMIN") throw new AppError(403, "FORBIDDEN");
      const id = Number(req.params["id"]);
      const season = await this.service.closeSeason(id);
      res.status(200).json(season);
    } catch (err) {
      next(err);
    }
  };

  setWageCap = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.user!.role !== "ADMIN") throw new AppError(403, "FORBIDDEN");
      const id = Number(req.params["id"]);
      const season = await this.service.setWageCap(id, req.body as SetWageCapDto);
      res.status(200).json(season);
    } catch (err) {
      next(err);
    }
  };

  getWageCapKPI = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const kpi = await this.service.getWageCapKPI();
      res.status(200).json(kpi);
    } catch (err) {
      next(err);
    }
  };
}
