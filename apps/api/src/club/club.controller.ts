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
      const { name, countryId, ownerEmail, businessRegNumber, companyNumber, vatNumber } = req.body as {
        name?: unknown;
        countryId?: unknown;
        ownerEmail?: unknown;
        businessRegNumber?: unknown;
        companyNumber?: unknown;
        vatNumber?: unknown;
      };
      if (typeof name !== "string" || !name.trim()) {
        throw new AppError(400, "INVALID_CLUB_NAME");
      }
      if (!countryId || typeof countryId !== "number") {
        throw new AppError(400, "COUNTRY_REQUIRED");
      }
      const createDto: import("./club.dto").CreateClubDto = { name, countryId };
      if (typeof ownerEmail === "string") createDto.ownerEmail = ownerEmail;
      if (typeof businessRegNumber === "string") createDto.businessRegNumber = businessRegNumber;
      if (typeof companyNumber === "string") createDto.companyNumber = companyNumber;
      if (typeof vatNumber === "string") createDto.vatNumber = vatNumber;
      res.status(201).json(await this.service.create(createDto));
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
