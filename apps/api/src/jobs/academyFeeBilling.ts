import cron from "node-cron";
import { getPrisma } from "../lib/prisma";
import { NotificationRepository } from "../notification/notification.repo";
import { AcademyFeeRepository } from "../academy-fee/academy-fee.repo";
import { AcademyFeeService } from "../academy-fee/academy-fee.service";

const DEFAULT_MONTHLY_AMOUNT = 100000;

export function startAcademyFeeBillingJob() {
  cron.schedule("0 9 25 * *", async () => {
    const prisma = getPrisma();
    const service = new AcademyFeeService(new AcademyFeeRepository(prisma), new NotificationRepository(prisma));
    const now = new Date();
    await service.issueMonthlyFees(now.getFullYear(), now.getMonth() + 1, DEFAULT_MONTHLY_AMOUNT).catch(console.error);
  });
}
