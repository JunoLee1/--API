import type { PrismaClient } from '../generated/client'
import type { CreateAcademyFeeDto, FeeListQuery } from './dto/academy-fee.dto'

const INCLUDE = {
  player: { select: { id: true, playerName: true, teamId: true, status: true } },
  guardian: { select: { id: true, username: true } },
} as const

export class AcademyFeeRepository {
  constructor(private prisma: PrismaClient) {}

  findAll(query: FeeListQuery) {
    return this.prisma.academyFee.findMany({
      where: {
        ...(query.status && { status: query.status as any }),
        ...(query.year && { year: query.year }),
        ...(query.month && { month: query.month }),
        ...(query.teamId && { player: { teamId: query.teamId } }),
      },
      include: INCLUDE,
      orderBy: { createdAt: 'desc' },
    })
  }

  findById(id: number) {
    return this.prisma.academyFee.findUnique({ where: { id }, include: INCLUDE })
  }

  findByPlayer(playerId: string) {
    return this.prisma.academyFee.findMany({
      where: { playerId },
      include: INCLUDE,
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    })
  }

  findOverdue(beforeDate: Date) {
    return this.prisma.academyFee.findMany({
      where: { status: { in: ['PENDING', 'OVERDUE'] }, dueDate: { lt: beforeDate } },
      include: INCLUDE,
    })
  }

  findAllActiveYouthPlayers() {
    return this.prisma.player.findMany({
      where: { team: { type: 'YOUTH' }, guardianId: { not: null } },
      select: { id: true, playerName: true, teamId: true, guardianId: true },
    })
  }

  create(data: CreateAcademyFeeDto) {
    return this.prisma.academyFee.create({ data, include: INCLUDE })
  }

  createMany(fees: CreateAcademyFeeDto[]) {
    return this.prisma.academyFee.createMany({ data: fees, skipDuplicates: true })
  }

  updateStatus(id: number, status: string, extra?: { paidAt?: Date }) {
    return this.prisma.academyFee.update({
      where: { id },
      data: { status: status as any, ...extra },
      include: INCLUDE,
    })
  }

  submitPaymentProof(id: number, url: string) {
    return this.prisma.academyFee.update({
      where: { id },
      data: { status: 'SUBMITTED', paymentProofUrl: url, paymentSubmittedAt: new Date() },
      include: INCLUDE,
    })
  }

  approvePayment(id: number) {
    return this.prisma.academyFee.update({
      where: { id },
      data: { status: 'PAID', paidAt: new Date() },
      include: INCLUDE,
    })
  }

  lockPlayer(playerId: string) {
    return this.prisma.player.update({
      where: { id: playerId },
      data: { status: 'SUSPENDED' as any },
    })
  }

  getFinanceStats(year: number, month: number) {
    return this.prisma.academyFee.groupBy({
      by: ['status'],
      where: { year, month },
      _count: { id: true },
      _sum: { amount: true },
    })
  }
}
