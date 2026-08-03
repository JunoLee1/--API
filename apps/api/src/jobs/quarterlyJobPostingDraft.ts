import cron from "node-cron";
import { getPrisma } from "../lib/prisma";
import { HiringAutomationRepository } from "../hiring-automation/hiring-automation.repo";
import { HiringAutomationService } from "../hiring-automation/hiring-automation.service";

const TOP_N = 3;

export function startQuarterlyJobPostingDraftJob() {
  // 매 분기 첫째 날 오전 9시 (1월·4월·7월·10월 1일)
  cron.schedule("0 9 1 1,4,7,10 *", async () => {
    const prisma = getPrisma();

    const season = await prisma.season.findFirst({ where: { status: "ACTIVE" } });
    if (!season?.leagueLevel) return;

    const settings = await prisma.clubSettings.findFirst();
    const ibiBeta = settings?.ibiBeta ?? 1.0;

    const autoRepo = new HiringAutomationRepository(prisma);
    const autoService = new HiringAutomationService(autoRepo);

    const queue = await autoService.computePriorityQueue(
      { id: season.id, leagueLevel: season.leagueLevel as any },
      ibiBeta,
    );

    const highPriority = queue.queue.filter((q) => q.highPriority);
    const topN = queue.queue.slice(0, TOP_N);
    const selected = [
      ...new Map([...highPriority, ...topN].map((q) => [q.departmentId, q])).values(),
    ];

    const systemUser = await prisma.user.findFirst({ where: { role: "ADMIN" } });
    if (!systemUser) return;

    for (const item of selected) {
      const existing = await autoRepo.getActiveJobPostingsForDepartment(item.departmentId);
      if (existing.length > 0) continue;

      const draft = await autoRepo.createJobPostingDraft({
        title: `${item.departmentName} 채용`,
        departmentId: item.departmentId,
        headcount: 1,
        description: `현재 시즌(${season.leagueLevel}) 기준 채용 공고 자동 초안`,
        createdById: systemUser.id,
      });

      const recipients = await prisma.user.findMany({
        where: {
          role: "FRONT_OFFICE",
          frontOfficeRole: { in: ["HR_MANAGER", "GM"] },
          isDeleted: false,
        },
        select: { id: true },
      });

      if (recipients.length > 0) {
        await prisma.notification.createMany({
          data: recipients.map((r) => ({
            userId: r.id,
            type: "JOB_POSTING_DRAFT_CREATED" as any,
            title: "채용 공고 자동 초안 생성",
            body: `채용 공고 자동 초안이 생성되었습니다: ${draft.title}`,
            entityId: draft.id,
          })),
        });
      }
    }
  });
}
