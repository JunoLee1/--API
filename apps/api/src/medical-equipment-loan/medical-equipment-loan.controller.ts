import { Request, Response, NextFunction } from "express";
import { requireUser } from "../lib/authMiddleware";
import { medicalEquipmentLoanRepo } from "./medical-equipment-loan.repo";
import * as service from "./medical-equipment-loan.service";

export async function listLoans(req: Request, res: Response, next: NextFunction) {
  try {
    const { status, requestedById } = req.query as Record<string, string>;
    const result = await medicalEquipmentLoanRepo.findAll({
      ...(status && { status }),
      ...(requestedById && { requestedById: parseInt(requestedById) }),
    });
    res.json(result);
  } catch (e) {
    next(e);
  }
}

export async function requestNormal(req: Request, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    const result = await service.requestNormalLoan(user.id, req.body);
    res.status(201).json(result);
  } catch (e) {
    next(e);
  }
}

export async function requestEmergency(req: Request, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    const result = await service.requestEmergencyLoan(user.id, req.body);
    res.status(201).json(result);
  } catch (e) {
    next(e);
  }
}

export async function approve(req: Request, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    const ledgerId = parseInt(req.params.id as string);
    const result = await service.approveLoan(ledgerId, user.id, req.body);
    res.json(result);
  } catch (e) {
    next(e);
  }
}

export async function reject(req: Request, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    const ledgerId = parseInt(req.params.id as string);
    const result = await service.rejectLoan(ledgerId, user.id, req.body);
    res.json(result);
  } catch (e) {
    next(e);
  }
}
