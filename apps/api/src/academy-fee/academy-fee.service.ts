import { AppError } from "../lib/appError";
import type { AcademyFeeRepository } from "./academy-fee.repo";
import type { NotificationRepository } from "../notification/notification.repo";
import type { FeeListQuery, SubmitPaymentProofDto } from "./dto/academy-fee.dto";

function daysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

export class AcademyFeeService {
  constructor(
    private repo: AcademyFeeRepository,
    private notifRepo: NotificationRepository,
  ) {}

  getAll(query: FeeListQuery) { return this.repo.findAll(query); }
  getByPlayer(playerId: string) { return this.repo.findByPlayer(playerId); }

  async getById(id: number) {
    const fee = await this.repo.findById(id);
    if (!fee) throw new AppError(404, "FEE_NOT_FOUND");
    return fee;
  }

  async issueMonthlyFees(year: number, month: number, amount: number) {
    const players = await this.repo.findAllActiveYouthPlayers();
    const dueDate = new Date(year, month - 1, 25);
    const eligible = players.filter(p => p.guardianId !== null);
    await this.repo.createMany(
      eligible.map(p => ({ playerId: p.id, guardianId: p.guardianId!, amount, dueDate, year, month })),
    );
    for (const p of eligible) {
      void this.notifRepo.createForGuardian(
        p.guardianId!,
        "FEE_INVOICE_ISSUED",
        `${month}월 아카데미 회비 청구서`,
        `${p.playerName} 선수의 ${month}월 회비(${amount.toLocaleString()}원)가 청구됐습니다. 기한: ${dueDate.toLocaleDateString("ko-KR")}`,
      ).catch(console.error);
    }
  }

  async processOverdue() {
    const now = new Date();
    const overdueFees = await this.repo.findOverdue(now);
    for (const fee of overdueFees) {
      const days = daysSince(fee.dueDate);
      if (days >= 30) {
        await this.repo.updateStatus(fee.id, "LOCKED");
        if (fee.player.status !== "SUSPENDED") await this.repo.lockPlayer(fee.playerId);
        void this.notifRepo.createForGuardian(
          fee.guardianId, "FEE_ACCOUNT_LOCKED",
          "아카데미 회비 미납 — 훈련/경기 참가 정지",
          `${fee.player.playerName} 선수가 30일 이상 회비를 미납하여 참가가 정지됐습니다.`,
          fee.id,
        ).catch(console.error);
      } else if (days >= 7) {
        await this.repo.updateStatus(fee.id, "OVERDUE");
        void this.notifRepo.createForGuardian(
          fee.guardianId, "FEE_OVERDUE_WARNING",
          "아카데미 회비 미납 2차 안내",
          `${fee.player.playerName} 선수의 회비가 ${days}일째 미납 중입니다.`,
          fee.id,
        ).catch(console.error);
      } else if (days >= 1) {
        void this.notifRepo.createForGuardian(
          fee.guardianId, "FEE_REMINDER",
          "아카데미 회비 납부 안내",
          `${fee.player.playerName} 선수의 회비 납부 기한이 지났습니다.`,
          fee.id,
        ).catch(console.error);
      }
    }
  }

  async submitPaymentProof(id: number, dto: SubmitPaymentProofDto) {
    const fee = await this.repo.findById(id);
    if (!fee) throw new AppError(404, "FEE_NOT_FOUND");
    if (fee.status === "PAID") throw new AppError(409, "ALREADY_PAID");
    return this.repo.submitPaymentProof(id, dto.paymentProofUrl);
  }

  async approvePayment(id: number) {
    const fee = await this.repo.findById(id);
    if (!fee) throw new AppError(404, "FEE_NOT_FOUND");
    if (fee.status !== "SUBMITTED") throw new AppError(409, "INVALID_STATUS");
    const paid = await this.repo.approvePayment(id);
    void this.notifRepo.createForGuardian(
      fee.guardianId, "FEE_INVOICE_ISSUED",
      "아카데미 회비 수납 확인",
      `${fee.player.playerName} 선수의 회비 납부가 확인됐습니다.`,
      id,
    ).catch(console.error);
    return paid;
  }

  async getFinanceStats(year: number, month: number) {
    const rows = await this.repo.getFinanceStats(year, month);
    const total = rows.reduce((s, r) => s + (r._count.id ?? 0), 0);
    const paid = rows.find(r => r.status === "PAID")?._count.id ?? 0;
    const overdue = rows.filter(r => ["OVERDUE", "LOCKED"].includes(r.status as string))
      .reduce((s, r) => s + (r._count.id ?? 0), 0);
    const locked = rows.find(r => r.status === "LOCKED")?._count.id ?? 0;
    const totalRevenue = rows.find(r => r.status === "PAID")?._sum.amount ?? 0;
    return {
      monthlyCollectionRate: total > 0 ? Math.round((paid / total) * 100) : 0,
      totalRevenue,
      overdueCount: overdue,
      lockedPlayerCount: locked,
    };
  }
}
