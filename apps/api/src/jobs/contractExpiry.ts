import cron from "node-cron";
import { getPrisma } from "../lib/prisma";

export function startContractExpiryJob() {
  cron.schedule("0 0 * * *", async () => {
    const prisma = getPrisma();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await prisma.contract.updateMany({
      where: {
        status: "ACTIVE",
        endDate: { lt: today },
      },
      data: { status: "EXPIRED" },
    });
  });
}
