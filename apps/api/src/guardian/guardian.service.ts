import crypto from "crypto";
import { AppError } from "../lib/appError";
import { decrypt } from "../lib/crypto";
import type { GuardianRepository } from "./guardian.repo";
import type { LinkBySearchDto, LinkByCodeDto, IssueInviteCodeDto } from "./dto/guardian.dto";

export class GuardianService {
  constructor(private repo: GuardianRepository) {}

  async linkBySearch(dto: LinkBySearchDto, guardianId: number) {
    const player = await this.repo.findPlayerBySearch(
      dto.studentCode,
      dto.playerName,
    );
    if (!player) throw new AppError(404, "PLAYER_NOT_FOUND");

    // dateOfBirth is now encrypted — verify by decrypting and comparing date string
    if (player.dateOfBirthEncrypted && player.dateOfBirthIv) {
      const decryptedDob = decrypt(player.dateOfBirthEncrypted, player.dateOfBirthIv);
      const requestedDob = new Date(dto.dateOfBirth).toISOString().slice(0, 10);
      const storedDob = new Date(decryptedDob).toISOString().slice(0, 10);
      if (requestedDob !== storedDob) throw new AppError(404, "PLAYER_NOT_FOUND");
    }

    if (player.guardianId !== null) throw new AppError(409, "ALREADY_LINKED");
    return this.repo.linkGuardianToPlayer(player.id, guardianId);
  }

  async linkByCode(dto: LinkByCodeDto, guardianId: number) {
    const record = await this.repo.findInviteCode(dto.code);
    if (!record) throw new AppError(404, "INVALID_CODE");
    if (record.usedAt !== null) throw new AppError(409, "CODE_ALREADY_USED");
    if (record.expiresAt < new Date()) throw new AppError(410, "CODE_EXPIRED");

    await Promise.all([
      this.repo.linkGuardianToPlayer(record.playerId, guardianId),
      this.repo.markCodeUsed(record.id, guardianId),
    ]);
  }

  async issueInviteCode(dto: IssueInviteCodeDto, issuedById: number) {
    const existing = await this.repo.findActiveInviteCode(dto.playerId);
    if (existing) return existing;

    const code = crypto.randomBytes(16).toString("hex").toUpperCase();
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
    return this.repo.createInviteCode({ code, playerId: dto.playerId, issuedById, expiresAt });
  }

  async getChildren(guardianId: number) {
    return this.repo.findChildrenByGuardian(guardianId);
  }

  async getDashboard(playerId: string) {
    const child = await this.repo.findChildById(playerId);
    if (!child) throw new AppError(404, "CHILD_NOT_FOUND");

    const [
      childInfo, matches, sessions, attendanceGroups,
      latestEval, activePlan, injuries, lastMatchStats, fees,
    ] = await this.repo.findDashboard(child.id, child.teamId ?? null, new Date());

    const attendanceMap = Object.fromEntries(
      (attendanceGroups as any[]).map((g: any) => [g.attendance, g._count.attendance])
    );

    const activeInjuries = (injuries as any[]).filter((i: any) =>
      !["RECOVERED", "RETURNED"].includes(i.status)
    );
    const historyInjuries = (injuries as any[]).filter((i: any) =>
      ["RECOVERED", "RETURNED"].includes(i.status)
    );

    return {
      child: childInfo,
      upcoming: { matches, sessions },
      attendance: {
        total: (attendanceGroups as any[]).reduce((s: number, g: any) => s + g._count.attendance, 0),
        attended: attendanceMap["ATTENDED"] ?? 0,
        absent: attendanceMap["ABSENT"] ?? 0,
        late: attendanceMap["LATE"] ?? 0,
      },
      growth: { latestEvaluation: latestEval ?? null, activeDevelopmentPlan: activePlan ?? null },
      injuries: { active: activeInjuries, history: historyInjuries },
      stats: { lastMatch: lastMatchStats ?? null },
      fees: {
        pending: (fees as any[]).filter((f: any) => f.status === "PENDING"),
        overdue: (fees as any[]).filter((f: any) => f.status === "OVERDUE"),
      },
    };
  }
}
