import { Request, Response, NextFunction } from "express";
import { PlayerService } from "./player.service";

export class PlayerController {
  constructor(private service: PlayerService) {}

  createPlayer = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const player = await this.service.createPlayer(req.body);
      res.status(201).json(player);
    } catch (err) {
      next(err);
    }
  };

  getPlayerById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params["id"] as string;
      const player = await this.service.getPlayerById(id);
      res.status(200).json(player);
    } catch (err) {
      next(err);
    }
  };

  getPlayers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const skip = req.query["skip"] ? Number(req.query["skip"]) : undefined;
      const take = req.query["take"] ? Number(req.query["take"]) : undefined;
      const players = await this.service.getPlayers({
        ...(skip !== undefined && { skip }),
        ...(take !== undefined && { take }),
      });
      res.status(200).json(players);
    } catch (err) {
      next(err);
    }
  };

  linkUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params["id"] as string;
      const { userId } = req.body;
      const player = await this.service.linkUser(id, userId);
      res.status(200).json(player);
    } catch (err) {
      next(err);
    }
  };

  updatePlayer = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params["id"] as string;
      const player = await this.service.updatePlayer(id, req.body);
      res.status(200).json(player);
    } catch (err) {
      next(err);
    }
  };
}
