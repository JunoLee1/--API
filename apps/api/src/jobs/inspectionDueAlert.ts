import cron from 'node-cron';
import { getPrisma } from '../lib/prisma';
import type { PrismaClient } from '../generated/client';

// TR9: When inspection completion → nextInspectionDue auto-update is needed,
// wire it here once the schema adds an equipmentUnitId FK on FacilityInspection.
// Currently FacilityInspection has no relation to EquipmentUnit, so the
// nextInspectionDue field on EquipmentUnit must be set manually or via a
// separate update endpoint until the FK is added.

export async function runInspectionDueAlert(prisma: PrismaClient = getPrisma()) {
  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const units = await prisma.equipmentUnit.findMany({
    where: {
      nextInspectionDue: { gte: now, lte: in7Days },
      status: { not: 'RETIRED' as any },
    },
    include: { item: { select: { name: true } } },
  });

  if (units.length === 0) return;

  const managers = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] as any[] } },
    select: { id: true },
  });

  await Promise.all(
    units.flatMap(unit =>
      managers.map(mgr =>
        prisma.notification.create({
          data: {
            userId: mgr.id,
            type: 'EQUIPMENT_INSPECTION_DUE' as any,
            message: `장비 점검 예정: ${unit.item.name} — ${unit.nextInspectionDue!.toLocaleDateString('ko-KR')}까지`,
            message_en: `Equipment inspection due: ${unit.item.name} — by ${unit.nextInspectionDue!.toLocaleDateString('en-GB')}`,
          },
        }).catch(console.error)
      )
    )
  );
}

export function startInspectionDueCron() {
  cron.schedule('0 8 * * *', () => {
    runInspectionDueAlert().catch(console.error);
  });
}
