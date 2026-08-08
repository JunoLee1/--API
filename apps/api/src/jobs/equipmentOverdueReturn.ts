import cron from "node-cron";
import { getPrisma } from "../lib/prisma";

export function startEquipmentOverdueReturnJob() {
  // Run daily at 08:00
  cron.schedule("0 8 * * *", async () => {
    const prisma = getPrisma();
    const now = new Date();

    try {
      // Find loans past their expected return date (if dueDate exists) or older than 30 days
      const overdueLoans = await (prisma.equipmentLoan as any).findMany({
        where: {
          returnedAt: null,
          loanedAt: { lt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
        },
        select: {
          id: true,
          loanedAt: true,
          borrowedById: true,
          unit: { select: { name: true, serialNumber: true } },
        },
      });

      for (const loan of overdueLoans) {
        // Notify equipment manager
        await (prisma as any).notification.create({
          data: {
            userId: loan.borrowedById,
            type: "EQUIPMENT_RETURN_OVERDUE",
            title: "장비 반납 기한 초과",
            body: `${loan.unit?.name ?? "장비"} (${loan.unit?.serialNumber ?? loan.id}) 반납이 30일을 초과했습니다.`,
            entityId: loan.id,
          } as any,
        }).catch(console.error);
      }

      if (overdueLoans.length > 0) {
        console.log(`[EquipmentOverdue] ${overdueLoans.length} overdue loans flagged`);
      }
    } catch (err) {
      console.error("[EquipmentOverdue] Job failed:", err);
    }
  });
}
