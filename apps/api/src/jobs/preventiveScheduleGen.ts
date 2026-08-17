import cron from "node-cron";
import { getPrisma } from "../lib/prisma";

async function runPreventiveScheduleGen() {
  const prisma = getPrisma();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const schedules = await prisma.preventiveSchedule.findMany({
    where: { isActive: true },
  });

  let generated = 0;

  const adminUser = await prisma.user.findFirst({
    where: { role: "ADMIN" as any },
    select: { id: true },
  });
  if (!adminUser) {
    console.error("[preventiveScheduleGen] no ADMIN user found, skipping");
    return;
  }

  for (const schedule of schedules) {
    // Per-row interval check (Prisma can't filter by intervalDays in a where clause)
    if (schedule.lastGeneratedAt) {
      const nextDue = new Date(schedule.lastGeneratedAt.getTime() + schedule.intervalDays * 24 * 60 * 60 * 1000);
      nextDue.setHours(0, 0, 0, 0);
      if (nextDue > today) continue;
    }

    // Skip if pending request already exists for this schedule
    const pending = await prisma.maintenanceRequest.findFirst({
      where: {
        sourceScheduleId: schedule.id,
        status: { in: ["OPEN", "IN_PROGRESS", "PENDING_APPROVAL"] as any[] },
      },
    });
    if (pending) continue;

    // Create maintenance request
    await prisma.maintenanceRequest.create({
      data: {
        title: `[정기점검] ${schedule.title}`,
        description: schedule.description ?? `${schedule.facilityZone} 구역 정기 예방 유지보수`,
        priority: schedule.priority as any,
        status: "OPEN" as any,
        sourceScheduleId: schedule.id,
        createdById: adminUser.id,
        ...(schedule.partnerId && { partnerId: schedule.partnerId }),
      },
    });

    await prisma.preventiveSchedule.update({
      where: { id: schedule.id },
      data: { lastGeneratedAt: today },
    });

    generated++;
  }

  console.log(`[preventiveScheduleGen] generated ${generated} requests from ${schedules.length} schedules at ${today.toISOString()}`);
}

export function startPreventiveScheduleGenJob() {
  cron.schedule("0 7 * * *", () => {
    runPreventiveScheduleGen().catch(console.error);
  });
  console.log("[preventiveScheduleGen] scheduled at 07:00 daily");
}
