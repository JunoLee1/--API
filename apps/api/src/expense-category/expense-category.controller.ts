import { Request, Response, NextFunction } from "express";
import { ExpenseCategoryService } from "./expense-category.service";

export class ExpenseCategoryController {
  constructor(private service: ExpenseCategoryService) {}

  list = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const rows = await this.service.listActive();
      res.json(rows);
    } catch (err) {
      next(err);
    }
  };
}
