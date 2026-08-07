import { AppError } from "../lib/appError";
import { maskEmail } from "../lib/maskPii";
import type { YouthRegistrationRepository } from "./youth-registration.repo";
import type { NotificationRepository } from "../notification/notification.repo";
import type { CreateYouthRegistrationDto, RejectYouthRegistrationDto, YouthRegistrationListQuery } from "./dto/youth-registration.dto";

function maskGuardianEmail<T extends { guardian?: { email: string } | null }>(reg: T): T {
  if (!reg.guardian) return reg;
  return { ...reg, guardian: { ...reg.guardian, email: maskEmail(reg.guardian.email) } };
}

export class YouthRegistrationService {
  constructor(
    private repo: YouthRegistrationRepository,
    private notifRepo: NotificationRepository,
    private inviteService: { inviteUser: (data: { email: string; role: string }) => Promise<{ id: number }> },
  ) {}

  async getAll(query: YouthRegistrationListQuery) {
    const regs = await this.repo.findAll(query);
    return regs.map(maskGuardianEmail);
  }

  async getById(id: number) {
    const reg = await this.repo.findById(id);
    if (!reg) throw new AppError(404, "YOUTH_REGISTRATION_NOT_FOUND");
    return maskGuardianEmail(reg);
  }

  async create(dto: CreateYouthRegistrationDto, requestedById: number) {
    let guardianId: number | undefined;

    const existingGuardian = await this.repo.findGuardianByEmail(dto.guardianEmail);
    if (existingGuardian) {
      guardianId = existingGuardian.id;
    } else {
      const invited = await this.inviteService.inviteUser({ email: dto.guardianEmail, role: "GUARDIAN" });
      guardianId = invited.id;
    }

    return this.repo.create({ ...dto, requestedById, guardianId });
  }

  async guardianApprove(id: number, guardianUserId: number) {
    const reg = await this.repo.findById(id);
    if (!reg) throw new AppError(404, "YOUTH_REGISTRATION_NOT_FOUND");
    if (reg.guardianId !== guardianUserId) throw new AppError(403, "FORBIDDEN");
    if (reg.status !== "PENDING") throw new AppError(409, "INVALID_STATUS");

    return this.repo.updateStatus(id, "GUARDIAN_APPROVED");
  }

  async reject(id: number, dto: RejectYouthRegistrationDto) {
    const reg = await this.repo.findById(id);
    if (!reg) throw new AppError(404, "YOUTH_REGISTRATION_NOT_FOUND");
    if (!["PENDING", "GUARDIAN_APPROVED"].includes(reg.status)) throw new AppError(409, "INVALID_STATUS");

    const updated = await this.repo.updateStatus(id, "REJECTED", { rejectionReason: dto.rejectionReason });

    if (reg.guardianId) {
      void this.notifRepo
        .createForGuardian(reg.guardianId, "YOUTH_REGISTRATION_STATUS_CHANGED", () => ({ title: "입단 신청 반려", body: `${reg.playerName} 선수의 입단 신청이 반려됐습니다.` }), id)
        .catch(console.error);
    }
    return updated;
  }

  async contract(id: number, requestedById: number, nationalityId: number) {
    const reg = await this.repo.findById(id);
    if (!reg) throw new AppError(404, "YOUTH_REGISTRATION_NOT_FOUND");
    if (reg.status !== "GUARDIAN_APPROVED") throw new AppError(409, "INVALID_STATUS");

    const player = await this.repo.contractAndCreatePlayer(id, reg, nationalityId);

    if (reg.guardianId) {
      void this.notifRepo
        .createForGuardian(reg.guardianId, "YOUTH_REGISTRATION_STATUS_CHANGED", () => ({ title: "입단 완료", body: `${reg.playerName} 선수가 정식 입단했습니다.` }), id)
        .catch(console.error);
    }

    return player;
  }
}
