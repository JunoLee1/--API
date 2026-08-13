import cron from 'node-cron'
import { getPrisma } from '../lib/prisma'
import { HiringSurveyRepository } from '../hiring-survey/hiring-survey.repo'
import { HiringSurveyService } from '../hiring-survey/hiring-survey.service'
import { PlanReportRepository } from '../plan-report/plan-report.repo'
import { NotificationRepository } from '../notification/notification.repo'

export function startHiringSurveyReminderJob() {
  cron.schedule('0 9 * * *', async () => {
    const prisma = getPrisma()
    const repo = new HiringSurveyRepository(prisma)
    const planReportRepo = new PlanReportRepository(prisma)
    const notifRepo = new NotificationRepository(prisma)
    const service = new HiringSurveyService(repo, planReportRepo, notifRepo)

    const systemUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } })
    if (!systemUser) return

    await service.autoCloseExpired(systemUser.id)
    await service.sendDeadlineReminders()
  })
}
