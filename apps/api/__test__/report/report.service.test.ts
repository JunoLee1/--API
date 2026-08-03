import 'dotenv/config';
import { PrismaClient } from '../../src/generated/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { ReportRepository } from '../../src/report/report.repo';
import { ReportService } from '../../src/report/report.service';
import { NotificationRepository } from '../../src/notification/notification.repo';

const adapter = new PrismaPg({ connectionString: process.env['DATABASE_URL'] });
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

let hrStaffId: number;
let hrManagerId: number;
let assetManagerId: number;
let gmId: number;
let reportId: number;

beforeAll(async () => {
  const hrStaff = await prisma.user.findFirst({ where: { frontOfficeRole: 'HR_STAFF' }, select: { id: true } });
  if (!hrStaff) throw new Error('HR_STAFF 없음 — seed 필요');
  hrStaffId = hrStaff.id;

  const hrManager = await prisma.user.findFirst({ where: { frontOfficeRole: 'HR_MANAGER' }, select: { id: true } });
  if (!hrManager) throw new Error('HR_MANAGER 없음');
  hrManagerId = hrManager.id;

  const assetManager = await prisma.user.findFirst({ where: { frontOfficeRole: 'ASSET_MANAGER' }, select: { id: true } });
  if (!assetManager) throw new Error('ASSET_MANAGER 없음');
  assetManagerId = assetManager.id;

  const gm = await prisma.user.findFirst({ where: { frontOfficeRole: 'GM' }, select: { id: true } });
  if (!gm) throw new Error('GM 없음');
  gmId = gm.id;
});

afterAll(async () => {
  if (reportId) await prisma.report.deleteMany({ where: { id: reportId } });
  await prisma.$disconnect();
});

const makeService = () => {
  const repo = new ReportRepository(prisma);
  const notifRepo = new NotificationRepository(prisma);
  return new ReportService(repo, notifRepo);
};

describe('HR 보고서 3단계 결재', () => {
  it('HR_STAFF가 HR 보고서 생성 → DRAFT', async () => {
    const svc = makeService();
    const r = await svc.create({ authorId: hrStaffId, type: 'HR', title: '테스트 HR 보고서', content: '내용' });
    expect(r.status).toBe('DRAFT');
    reportId = r.id;
  });

  it('제출 → SUBMITTED', async () => {
    const svc = makeService();
    const r = await svc.submit(reportId, hrStaffId);
    expect(r.status).toBe('SUBMITTED');
  });

  it('HR_MANAGER 1차 승인 → FIRST_APPROVED', async () => {
    const svc = makeService();
    const r = await svc.approve(reportId, hrManagerId);
    expect(r.status).toBe('FIRST_APPROVED');
    expect((r as any).firstReviewerId).toBe(hrManagerId);
  });

  it('ASSET_MANAGER 2차 승인 → SECOND_APPROVED', async () => {
    const svc = makeService();
    const r = await svc.approve(reportId, assetManagerId);
    expect(r.status).toBe('SECOND_APPROVED');
    expect((r as any).secondReviewerId).toBe(assetManagerId);
  });

  it('GM 최종 승인 → APPROVED', async () => {
    const svc = makeService();
    const r = await svc.approve(reportId, gmId);
    expect(r.status).toBe('APPROVED');
    expect((r as any).reviewerId).toBe(gmId);
  });
});

describe('HR 보고서 반려 후 재제출', () => {
  let rejectedReportId: number;

  it('HR_STAFF 생성 → 제출', async () => {
    const svc = makeService();
    const r = await svc.create({ authorId: hrStaffId, type: 'HR', title: '반려 테스트', content: '내용' });
    rejectedReportId = r.id;
    await svc.submit(rejectedReportId, hrStaffId);
  });

  it('HR_MANAGER 반려 → REJECTED', async () => {
    const svc = makeService();
    const r = await svc.reject(rejectedReportId, hrManagerId, '내용 보완 필요');
    expect(r.status).toBe('REJECTED');
    expect(r.rejectionReason).toBe('내용 보완 필요');
  });

  it('작성자 수정 후 재제출 → SUBMITTED', async () => {
    const svc = makeService();
    await svc.update(rejectedReportId, hrStaffId, { content: '보완된 내용' });
    const r = await svc.submit(rejectedReportId, hrStaffId);
    expect(r.status).toBe('SUBMITTED');
    await prisma.report.deleteMany({ where: { id: rejectedReportId } });
  });
});
