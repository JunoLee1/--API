import { CoachingStaffRepository } from "./coaching-staff.repo";

export class CoachingStaffService {
  constructor(private repo: CoachingStaffRepository) {}

  getAll(weekStart: Date, weekEnd: Date) {
    return this.repo.findAll(weekStart, weekEnd);
  }
}
