import cron from "node-cron";
import { getPrisma } from "../lib/prisma";
import { NotificationRepository } from "../notification/notification.repo";
import { AcademyFeeRepository } from "../academy-fee/academy-fee.repo";
import { AcademyFeeService } from "../academy-fee/academy-fee.service";

export async function runDelinquencyCheck() {
  const prisma = getPrisma();
  const service = new AcademyFeeService(new AcademyFeeRepository(prisma), new NotificationRepository(prisma));
  await service.processOverdue();
}

export function startAcademyFeeDelinquencyJob() {
  cron.schedule("0 9 * * *", () => { runDelinquencyCheck().catch(console.error); }, { timezone: "Asia/Seoul" });
}
