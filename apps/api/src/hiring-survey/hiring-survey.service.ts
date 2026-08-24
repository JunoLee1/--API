import { AppError } from '../lib/appError'
import { NotificationRepository } from '../notification/notification.repo'
import { PlanReportRepository } from '../plan-report/plan-report.repo'
import { HiringSurveyRepository } from './hiring-survey.repo'
import type { CreateHiringSurveyDto, CreateSurveyResponseDto } from './dto/hiring-survey.dto'

export class HiringSurveyService {
  constructor(
    private repo: HiringSurveyRepository,
    private planReportRepo: PlanReportRepository,
    private notifRepo: NotificationRepository,
  ) {}

  list() {
    return this.repo.findAll()
  }

  async getById(id: number) {
    const survey = await this.repo.findById(id)
    if (!survey) throw new AppError(404, 'SURVEY_NOT_FOUND')
    return survey
  }

  async create(dto: CreateHiringSurveyDto, createdById: number) {
    if (!dto.title?.trim()) throw new AppError(400, 'TITLE_REQUIRED')
    if (!dto.deadlineAt) throw new AppError(400, 'DEADLINE_REQUIRED')
    if (!dto.targetDeptIds?.length) throw new AppError(400, 'TARGET_DEPTS_REQUIRED')

    const survey = await this.repo.create(dto, createdById)

    const headIds = survey.targetDepartments
      .map((t) => t.department.headId)
      .filter((id): id is number => id !== null)

    await Promise.all(
      headIds.map((userId) =>
        this.notifRepo.create({
          userId,
          type: 'HIRING_SURVEY_OPEN',
          title: '채용 수요 조사 참여 요청',
          body: `"${survey.title}" 채용 수요 조사에 응답해 주세요. 마감일: ${new Date(dto.deadlineAt).toLocaleDateString('ko-KR')}`,
          entityId: survey.id,
        })
      )
    )

    return survey
  }

  async submitResponse(
    surveyId: number,
    userId: number,
    dto: CreateSurveyResponseDto,
  ) {
    const survey = await this.getById(surveyId)
    if (survey.status !== 'OPEN') throw new AppError(409, 'SURVEY_NOT_OPEN')

    const target = survey.targetDepartments.find((t) => t.department.headId === userId)
    if (!target) throw new AppError(403, 'NOT_TARGET_DEPARTMENT_HEAD')

    if (!dto.roleTitle?.trim()) throw new AppError(400, 'ROLE_TITLE_REQUIRED')
    if (!dto.headcount || dto.headcount < 1) throw new AppError(400, 'INVALID_HEADCOUNT')
    if (dto.quarter !== undefined && dto.quarter !== null && (dto.quarter < 1 || dto.quarter > 4)) {
      throw new AppError(400, 'INVALID_QUARTER')
    }

    const response = await this.repo.upsertResponse(surveyId, target.departmentId, userId, dto)

    // 모든 target 부서가 응답 완료 시 HR 매니저에게 알림
    const respondedDeptIds = new Set(survey.responses.map((r) => r.departmentId))
    respondedDeptIds.add(target.departmentId)
    const allResponded = survey.targetDepartments.every((t) =>
      respondedDeptIds.has(t.departmentId),
    )
    if (allResponded) {
      void this.notifRepo.createForHrManager(
        'HIRING_SURVEY_ALL_RESPONDED',
        (lang) => ({
          title: lang === 'en' ? 'Hiring survey — all departments responded' : '채용 수요 조사 응답 완료',
          body:
            lang === 'en'
              ? `"${survey.title}" — all ${survey.targetDepartments.length} target departments have responded. Ready to close.`
              : `"${survey.title}" — 대상 ${survey.targetDepartments.length}개 부서 응답 완료. 조사 마감 준비됨.`,
        }),
        survey.id,
      ).catch(console.error)
    }

    return response
  }

  async close(surveyId: number, closedByUserId: number) {
    const survey = await this.getById(surveyId)
    if (survey.status !== 'OPEN') throw new AppError(409, 'SURVEY_NOT_OPEN')

    await this.repo.close(surveyId)

    const responses = await this.repo.findResponsesBySurvey(surveyId)

    const planReport = await this.planReportRepo.createDraftForSurvey({
      surveyId,
      createdById: closedByUserId,
      title: `${survey.title} — 연간 채용 계획서`,
    })

    if (responses.length > 0) {
      await this.planReportRepo.createHiringPlanItems(
        responses.map((r) => {
          const item: {
            planReportId: number
            surveyResponseId: number
            roleTitle: string
            headcount: number
            quarter?: number
            priority: any
            estimatedBudget?: number
          } = {
            planReportId: planReport.id,
            surveyResponseId: r.id,
            roleTitle: r.roleTitle,
            headcount: r.headcount,
            priority: r.priority as any,
          }
          if (r.quarter != null) item.quarter = r.quarter
          if (r.estimatedBudget != null) item.estimatedBudget = r.estimatedBudget
          return item
        })
      )
    }

    void this.notifRepo.createForHrManager(
      'HIRING_SURVEY_CLOSED',
      () => ({
        title: '채용 수요 조사 마감',
        body: `"${survey.title}" 조사가 마감됐습니다. 계획 항목 ${responses.length}건이 생성됐습니다.`,
      }),
      surveyId,
    ).catch(console.error)

    return planReport
  }

  async getParticipationRate(surveyId: number) {
    const survey = await this.getById(surveyId);
    const targetCount = survey.targetDepartments.length;
    const respondedIds = new Set(survey.responses.map((r) => r.departmentId));
    const respondedCount = respondedIds.size;
    const unrespondedDepts = survey.targetDepartments
      .filter((t) => !respondedIds.has(t.departmentId))
      .map((t) => ({ departmentId: t.departmentId, departmentName: t.department.name }));

    return {
      surveyId,
      status: survey.status,
      targetCount,
      respondedCount,
      participationRate: targetCount > 0 ? Math.round((respondedCount / targetCount) * 1000) / 10 : 0,
      unrespondedDepts,
    };
  }

  async autoCloseExpired(systemUserId: number) {
    const expired = await this.repo.findOpenPastDeadline()
    for (const survey of expired) {
      await this.close(survey.id, systemUserId).catch(console.error)
    }
  }

  async sendDeadlineReminders() {
    const targetDate = new Date()
    targetDate.setDate(targetDate.getDate() + 3)

    const surveys = await this.repo.findOpenNearDeadline(targetDate)

    for (const survey of surveys) {
      const respondedDeptIds = new Set(survey.responses.map((r) => r.departmentId))
      const unrespondedHeadIds = survey.targetDepartments
        .filter((t) => !respondedDeptIds.has(t.departmentId))
        .map((t) => t.department.headId)
        .filter((id): id is number => id !== null)

      await Promise.all(
        unrespondedHeadIds.map((userId) =>
          this.notifRepo.create({
            userId,
            type: 'HIRING_SURVEY_DEADLINE_REMINDER',
            title: '채용 수요 조사 마감 D-3',
            body: `"${survey.title}" 채용 수요 조사 마감이 3일 남았습니다. 아직 응답하지 않으셨습니다.`,
            entityId: survey.id,
          })
        )
      )
    }
  }
}
