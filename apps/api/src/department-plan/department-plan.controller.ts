import { Request, Response, NextFunction } from "express";
import { DepartmentPlanService } from "./department-plan.service";

export class DepartmentPlanController {
  constructor(private service: DepartmentPlanService) {}

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filters: import("./dto/department-plan.dto").ListDepartmentPlanQuery = {}
      if (req.query["seasonId"]) filters.seasonId = Number(req.query["seasonId"])
      if (req.query["departmentId"]) filters.departmentId = Number(req.query["departmentId"])
      if (req.query["status"]) filters.status = req.query["status"] as string
      res.status(200).json(await this.service.list(filters));
    } catch (err) { next(err); }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(200).json(await this.service.getById(Number(req.params["id"])));
    } catch (err) { next(err); }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(201).json(await this.service.create(req.body, req.user!.id));
    } catch (err) { next(err); }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      res.status(200).json(
        await this.service.update(
          Number(req.params["id"]),
          req.body,
          req.user!.id,
          role,
          frontOfficeRole
        )
      );
    } catch (err) { next(err); }
  };

  submit = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(200).json(await this.service.submit(Number(req.params["id"]), req.user!.id));
    } catch (err) { next(err); }
  };

  approve = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(200).json(
        await this.service.approve(Number(req.params["id"]), req.user!.id, req.user!.role)
      );
    } catch (err) { next(err); }
  };

  reject = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { reason } = req.body as { reason: string };
      res.status(200).json(
        await this.service.reject(
          Number(req.params["id"]),
          req.user!.id,
          req.user!.role,
          reason
        )
      );
    } catch (err) { next(err); }
  };

  budgetSummary = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const seasonId = Number(req.query["seasonId"]);
      if (!seasonId) {
        res.status(400).json({ message: "seasonId is required" });
        return;
      }
      res.status(200).json(await this.service.getBudgetSummary(seasonId));
    } catch (err) { next(err); }
  };
}
