import { AppError } from "../../lib/appError";
import type { ExposureRepository } from "./exposure.repo";
import type { CreateExposureEventDto } from "./dto/exposure.dto";

export class ExposureService {
  constructor(private repo: ExposureRepository) {}

  list(sponsorshipId: number) {
    return this.repo.findAll(sponsorshipId);
  }

  async create(sponsorshipId: number, dto: CreateExposureEventDto, createdById: number) {
    if (!dto.exposureCount && !dto.fanReach && !dto.mediaValue) {
      throw new AppError(400, "EXPOSURE_METRIC_REQUIRED");
    }
    return this.repo.create(sponsorshipId, { ...dto, createdById });
  }
}
