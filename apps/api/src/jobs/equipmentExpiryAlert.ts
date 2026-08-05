import cron from "node-cron";
import { getPrisma } from "../lib/prisma";
import { NotificationRepository } from "../notification/notification.repo";

export function startEquipmentExpiryAlertJob() {
  cron.schedule("0 9 * * *", async () => {
    const prisma = getPrisma();
    const notifRepo = new NotificationRepository(prisma);
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const expiringUnits = await prisma.equipmentUnit.findMany({
      where: { expiresAt: { lte: thirtyDaysFromNow, gt: new Date() } },
      select: { id: true, serialNumber: true, item: { select: { name: true } } },
    });
    const expiringLicenses = await prisma.softwareLicense.findMany({
      where: { expiresAt: { lte: thirtyDaysFromNow, gt: new Date() } },
      select: { id: true, name: true },
    });

    const managers = await prisma.user.findMany({
      where: { frontOfficeRole: "ASSET_MANAGER", isDeleted: false },
      select: { id: true },
    });

    for (const unit of expiringUnits) {
      for (const m of managers) {
        await notifRepo.create({
          userId: m.id,
          type: "IT_ASSET_EXPIRY_SOON",
          title: "IT 자산 만료 임박",
          body: `${unit.item.name} (${unit.serialNumber ?? `#${unit.id}`}) 만료 30일 전입니다.`,
        });
      }
    }
    for (const license of expiringLicenses) {
      for (const m of managers) {
        await notifRepo.create({
          userId: m.id,
          type: "IT_ASSET_EXPIRY_SOON",
          title: "라이선스 만료 임박",
          body: `${license.name} 라이선스 만료 30일 전입니다.`,
        });
      }
    }
  });
}
