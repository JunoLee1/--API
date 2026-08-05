import cron from "node-cron";
import { getPrisma } from "../lib/prisma";
import { NotificationRepository } from "../notification/notification.repo";

export function startInventoryThresholdJob() {
  cron.schedule("0 9 * * *", async () => {
    const prisma = getPrisma();
    const notifRepo = new NotificationRepository(prisma);

    // Prisma can't compare two columns in where clause without raw SQL
    const allItems = await prisma.facilityInventoryItem.findMany();
    const belowThreshold = allItems.filter(i => i.quantity <= i.minThreshold);

    const managers = await prisma.user.findMany({
      where: { frontOfficeRole: "FACILITY_MANAGER", isDeleted: false },
      select: { id: true },
    });

    for (const item of belowThreshold) {
      for (const m of managers) {
        await notifRepo.create({
          userId: m.id,
          type: "INVENTORY_LOW_STOCK",
          title: "재고 부족 경고",
          body: `${item.name} 재고가 ${item.quantity}${item.unit}로 임계치(${item.minThreshold}) 이하입니다.`,
        });
      }
    }
  });
}
