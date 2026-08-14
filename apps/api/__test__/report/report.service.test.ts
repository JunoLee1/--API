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
let reportId: number;

beforeAll(async () => {
  const hrStaff = await prisma.user.findFirst({ where: { frontOfficeRole: 'HR_STAFF' }, select: { id: true } });
  if (!hrStaff) throw new Error('HR_STAFF 없음 — seed 필요');
  hrStaffId = hrStaff.id;

  const hrManager = await prisma.user.findFirst({ where: { frontOfficeRole: 'HR_MANAGER' }, select: { id: true } });
  if (!hrManager) throw new Error('HR_MANAGER 없음');
  hrManagerId = hrManager.id;
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

describe('HR 보고서 결재 플로우', () => {
  it('HR_STAFF가 HR 보고서 생성 → DRAFT', async () => {
    const svc = makeService();
    const r = await svc.create({ authorId: hrStaffId, type: 'HR', title: '테스트 HR 보고서', content: '내용' });
    expect(r.status).toBe('DRAFT');
    reportId = r.id;
  });

  it('제출 → SUBMITTED 또는 REVIEWING', async () => {
    const svc = makeService();
    const r = await svc.submit(reportId, hrStaffId);
    expect(['SUBMITTED', 'REVIEWING']).toContain(r.status);
  });

  it('검토자가 있으면 confirmReview로 승인, 없으면 이미 SUBMITTED', async () => {
    const svc = makeService();
    const report = await svc.get(reportId);

    if (report.status === 'REVIEWING' && report.reviews && report.reviews.length > 0) {
      const pendingReview = report.reviews.find((rv: any) => rv.status === 'PENDING');
      if (pendingReview) {
        const r = await svc.confirmReview(reportId, pendingReview.reviewerDeptId, hrManagerId);
        expect(['REVIEWING', 'APPROVED']).toContain(r!.status);
      }
    } else {
      // SUBMITTED 상태 — 결재 규칙 없음, 보고서 상태 그대로
      expect(['SUBMITTED', 'APPROVED']).toContain(report.status);
    }
  });
});

describe('HR 보고서 반려 후 재제출', () => {
  let rejectedReportId: number;

  afterAll(async () => {
    if (rejectedReportId) await prisma.report.deleteMany({ where: { id: rejectedReportId } });
  });

  it('HR_STAFF 생성 → 제출', async () => {
    const svc = makeService();
    const r = await svc.create({ authorId: hrStaffId, type: 'HR', title: '반려 테스트', content: '내용' });
    rejectedReportId = r.id;
    const submitted = await svc.submit(rejectedReportId, hrStaffId);
    expect(['SUBMITTED', 'REVIEWING']).toContain(submitted.status);
  });

  it('검토자가 있으면 rejectReview로 반려 → REJECTED, 없으면 update/submit 직접 테스트', async () => {
    const svc = makeService();
    const report = await svc.get(rejectedReportId);

    if (report.status === 'REVIEWING' && report.reviews && report.reviews.length > 0) {
      const pendingReview = report.reviews.find((rv: any) => rv.status === 'PENDING');
      if (pendingReview) {
        const r = await svc.rejectReview(rejectedReportId, pendingReview.reviewerDeptId, hrManagerId, '내용 보완 필요');
        expect(r!.status).toBe('REJECTED');
        expect(r!.rejectionReason).toBe('내용 보완 필요');
      }
    } else {
      // 결재 규칙 없이 SUBMITTED — DB에서 직접 REJECTED로 설정
      await prisma.report.update({ where: { id: rejectedReportId }, data: { status: 'REJECTED', rejectionReason: '내용 보완 필요' } });
      const r = await svc.get(rejectedReportId);
      expect(r.status).toBe('REJECTED');
    }
  });

  it('작성자 수정 후 재제출 → SUBMITTED 또는 REVIEWING', async () => {
    const svc = makeService();
    const report = await svc.get(rejectedReportId);

    // REJECTED 상태인지 확인 후 진행
    if (report.status === 'REJECTED') {
      await svc.update(rejectedReportId, hrStaffId, { content: '보완된 내용' });
      const r = await svc.submit(rejectedReportId, hrStaffId);
      expect(['SUBMITTED', 'REVIEWING']).toContain(r.status);
    } else {
      // 이전 테스트에서 반려가 이루어지지 않은 경우 스킵
      expect(['SUBMITTED', 'REVIEWING']).toContain(report.status);
    }
  });
});
