import cron from "node-cron";
import { getPrisma } from "../lib/prisma";

export function startMonthlyDepreciationJob() {
  cron.schedule("0 0 1 * *", async () => {
    const prisma = getPrisma();
    const units = await prisma.equipmentUnit.findMany({
      where: {
        status: { not: "RETIRED" },
        depreciationMethod: { not: null },
        bookValue: { not: null },
      },
    });

    for (const unit of units) {
      if (!unit.depreciationRate || !unit.bookValue) continue;
      let newBookValue: number;
      if (unit.depreciationMethod === "DECLINING_BALANCE") {
        newBookValue = Number(unit.bookValue) * (1 - Number(unit.depreciationRate));
      } else {
        const purchase = unit.purchaseValue ? Number(unit.purchaseValue) : 0;
        newBookValue = Math.max(0, Number(unit.bookValue) - purchase * Number(unit.depreciationRate));
      }
      if (newBookValue < 0) newBookValue = 0;
      await prisma.equipmentUnit.update({
        where: { id: unit.id },
        data: { bookValue: newBookValue },
      });
    }
  });
}
