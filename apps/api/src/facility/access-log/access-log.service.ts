import { AppError } from "../../lib/appError";
import { canAccessZone } from "../../lib/facilityAccessControl";
import type { AccessLogRepository } from "./access-log.repo";
import type { LogAccessDto, AccessLogListQuery } from "./dto/access-log.dto";

export class AccessLogService {
  constructor(private repo: AccessLogRepository) {}

  list(query: AccessLogListQuery) {
    return this.repo.findAll(query);
  }

  async logAccess(userId: number, userRole: string, dto: LogAccessDto) {
    const allowed = canAccessZone(userRole, dto.zone);
    const action = allowed ? dto.action : "ATTEMPT_DENIED";
    await this.repo.create({ userId, zone: dto.zone, action, ...(dto.reason !== undefined && { reason: dto.reason }) });
    if (!allowed) throw new AppError(403, "ZONE_ACCESS_DENIED");
  }
}
