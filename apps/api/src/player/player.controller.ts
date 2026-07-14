import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import { PlayerService } from "./player.service";
import { PlayerListQuery } from "./dto/player.dto";
import { PlayerStatus, Position, PlayerLevel } from "../generated/enums";

const WRITE_ROLES = ["ADMIN", "FRONT_OFFICE"] as const;

export class PlayerController {
  constructor(private service: PlayerService) {}

  getPlayers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const q = req.query;
      const query: PlayerListQuery = {};
      if (q["status"]) query.status = q["status"] as PlayerStatus;
      if (q["position"]) query.position = q["position"] as Position;
      if (q["level"]) query.level = q["level"] as PlayerLevel;
      if (q["nationalityId"]) query.nationalityId = Number(q["nationalityId"]);
      const players = await this.service.getPlayers(query);
      res.status(200).json(players);
    } catch (err) {
      next(err);
    }
  };

  getPlayerById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const player = await this.service.getPlayerById(String(req.params["id"]));
      res.status(200).json(player);
    } catch (err) {
      next(err);
    }
  };

  createPlayer = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!WRITE_ROLES.includes(req.user!.role as (typeof WRITE_ROLES)[number])) {
        throw new AppError(403, "FORBIDDEN");
      }
      const player = await this.service.createPlayer(req.body);
      res.status(201).json(player);
    } catch (err) {
      next(err);
    }
  };

  updatePlayer = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!WRITE_ROLES.includes(req.user!.role as (typeof WRITE_ROLES)[number])) {
        throw new AppError(403, "FORBIDDEN");
      }
      const player = await this.service.updatePlayer(String(req.params["id"]), req.body);
      res.status(200).json(player);
    } catch (err) {
      next(err);
    }
  };

  updatePlayerStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.user!.role !== "ADMIN") throw new AppError(403, "FORBIDDEN");
      const result = await this.service.updatePlayerStatus(String(req.params["id"]), req.body);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  deletePlayer = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.user!.role !== "ADMIN") throw new AppError(403, "FORBIDDEN");
      await this.service.deletePlayer(String(req.params["id"]));
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };
}
