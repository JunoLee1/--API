import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import { VideoService } from "./video.service";

const CAN_WRITE = ["ADMIN", "COACHING_STAFF"];

export class VideoController {
  constructor(private service: VideoService) {}

  getVideos = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query: import("./dto/video.dto").VideoListQuery = {};
      if (req.query["sessionType"]) query.sessionType = req.query["sessionType"] as import("../generated/enums").SessionType;
      if (req.query["tag"]) query.tag = req.query["tag"] as string;
      res.json(await this.service.getVideos(query));
    } catch (err) { next(err); }
  };

  getVideoById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.getVideoById(Number(req.params["id"])));
    } catch (err) { next(err); }
  };

  createVideo = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!CAN_WRITE.includes(req.user!.role)) throw new AppError(403, "FORBIDDEN");
      res.status(201).json(await this.service.createVideo(req.body, req.user!.id));
    } catch (err) { next(err); }
  };

  deleteVideo = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!CAN_WRITE.includes(req.user!.role)) throw new AppError(403, "FORBIDDEN");
      await this.service.deleteVideo(
        Number(req.params["id"]),
        req.user!.id,
        req.user!.role === "ADMIN",
      );
      res.status(204).send();
    } catch (err) { next(err); }
  };

  getMyAssignments = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.user!.role !== "PLAYER") throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.getMyAssignments(req.user!.id));
    } catch (err) { next(err); }
  };

  createAssignment = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!CAN_WRITE.includes(req.user!.role)) throw new AppError(403, "FORBIDDEN");
      const dto: import("./dto/video.dto").CreateAssignmentDto = {
        videoId: Number(req.params["id"]),
        playerId: req.body.playerId,
        assignedById: req.user!.id,
      };
      if (req.body.dueDate) dto.dueDate = new Date(req.body.dueDate);
      if (req.body.note) dto.note = req.body.note;
      res.status(201).json(await this.service.createAssignment(dto));
    } catch (err) { next(err); }
  };

  updateProgress = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.user!.role !== "PLAYER") throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.updateProgress(
        Number(req.params["id"]),
        String(req.params["playerId"]),
        Number(req.body.progressRate),
        req.user!.id,
      ));
    } catch (err) { next(err); }
  };

  generateAiSummary = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!CAN_WRITE.includes(req.user!.role)) throw new AppError(403, "FORBIDDEN");
      res.status(200).json(
        await this.service.generateAiSummary(Number(req.params["id"])),
      );
    } catch (err) {
      next(err);
    }
  };
}
