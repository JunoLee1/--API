import { HospitalRepository } from "./hospital.repo";
import { AppError } from "../lib/appError";

export class HospitalService {
  constructor(private repo: HospitalRepository) {}

  list() {
    return this.repo.findAll();
  }

  create(data: { name: string; address?: string; phone?: string }) {
    if (!data.name?.trim()) throw new AppError(400, "HOSPITAL_NAME_REQUIRED");
    return this.repo.create({
      name: data.name.trim(),
      ...(data.address && { address: data.address }),
      ...(data.phone && { phone: data.phone }),
    });
  }
}
