import type { PrismaClient } from '../generated/client'
import type { CreateHiringSurveyDto, CreateSurveyResponseDto } from './dto/hiring-survey.dto'

const SURVEY_INCLUDE = {
  createdBy: { select: { id: true, username: true } },
  targetDepartments: {
    include: { department: { select: { id: true, name: true, headId: true } } },
  },
  responses: {
    include: {
      department: { select: { id: true, name: true } },
      submittedBy: { select: { id: true, username: true } },
    },
  },
} as const

export class HiringSurveyRepository {
  constructor(private prisma: PrismaClient) {}

  findAll() {
    return this.prisma.hiringNeedsSurvey.findMany({
      include: SURVEY_INCLUDE,
      orderBy: { createdAt: 'desc' },
    })
  }

  findById(id: number) {
    return this.prisma.hiringNeedsSurvey.findUnique({ where: { id }, include: SURVEY_INCLUDE })
  }

  create(dto: CreateHiringSurveyDto, createdById: number) {
    return this.prisma.hiringNeedsSurvey.create({
      data: {
        title: dto.title,
        deadlineAt: new Date(dto.deadlineAt),
        createdById,
        targetDepartments: {
          create: dto.targetDeptIds.map((departmentId) => ({ departmentId })),
        },
      },
      include: SURVEY_INCLUDE,
    })
  }

  close(id: number) {
    return this.prisma.hiringNeedsSurvey.update({
      where: { id },
      data: { status: 'CLOSED' },
    })
  }

  findOpenPastDeadline() {
    return this.prisma.hiringNeedsSurvey.findMany({
      where: { status: 'OPEN', deadlineAt: { lte: new Date() } },
      include: SURVEY_INCLUDE,
    })
  }

  findOpenNearDeadline(targetDate: Date) {
    const start = new Date(targetDate)
    start.setHours(0, 0, 0, 0)
    const end = new Date(targetDate)
    end.setHours(23, 59, 59, 999)
    return this.prisma.hiringNeedsSurvey.findMany({
      where: { status: 'OPEN', deadlineAt: { gte: start, lte: end } },
      include: SURVEY_INCLUDE,
    })
  }

  upsertResponse(
    surveyId: number,
    departmentId: number,
    submittedById: number,
    dto: CreateSurveyResponseDto,
  ) {
    return this.prisma.surveyResponse.upsert({
      where: { surveyId_departmentId: { surveyId, departmentId } },
      create: { surveyId, departmentId, submittedById, ...dto },
      update: { ...dto, submittedById },
    })
  }

  findResponsesBySurvey(surveyId: number) {
    return this.prisma.surveyResponse.findMany({ where: { surveyId } })
  }
}
