import { useEffect, useState } from 'react'
import { financialReportApi } from '@/services/financial-report.service'
import type { BudgetPlanStatus } from '@/services/budget-plan.service'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import type { UserDto } from '@/types/auth'
import { Skeleton } from '@/components/ui/skeleton'
import { PlanStatusBadge } from './PlanStatusBadge'
import { GmReplanPanel } from './GmReplanPanel'

interface Props {
  seasonId: number
}

/**
 * `FinancialReport` 응답에는 아직 `planStatus` 필드가 서비스 layer 타입에
 * 반영돼 있지 않다 (services/financial-report.service.ts 는 legacy shape).
 * 서버 (`apps/api/prisma/schema.prisma`) 는 이미 필드를 노출하므로 여기서
 * 좁혀 사용한다. Slice 통합 시 FinancialReport interface 에 planStatus 를
 * 추가하고 이 로컬 타입은 제거한다.
 */
interface FinancialReportWithPlanStatus {
  planStatus: BudgetPlanStatus
}

/**
 * `user.role + user.frontOfficeRole` 로 편성 워크플로우 상의 페르소나를 판정한다.
 *
 * - GM (단장) → GM 승인 패널
 * - FRONT_OFFICE + FINANCE_MANAGER → FM 심사 화면 (#429 slice)
 * - COACHING_STAFF (HEAD_COACH) or FRONT_OFFICE (FINANCE 외) → 팀장/부서장 편성 신청 위저드 (#427 slice)
 * - ADMIN/SUPER_ADMIN → 뱃지 + 안내만
 * - 그 외 → 빈 뷰
 *
 * 부서장 판정을 위해서는 `Department.headId === user.id` 매핑이 필요하나 이번 slice
 * 에서는 API/hook 이 아직 없어 role 기반으로만 판별한다. TODO(#432) 로 정합화 예정.
 */
type Persona = 'TEAM_LEADER' | 'FINANCE_MANAGER' | 'GM' | 'ADMIN' | 'OTHER'

function resolvePersona(user: UserDto): Persona {
  if (user.role === 'GM') return 'GM'
  if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') return 'ADMIN'
  if (user.role === 'FRONT_OFFICE') {
    if (user.frontOfficeRole === 'FINANCE_MANAGER') return 'FINANCE_MANAGER'
    // FRONT_OFFICE 중 FINANCE 계열 이외는 부서장 후보로 취급 (부서장 매핑
    // 정합화 전 임시 규칙 — headId 조회 API 도입 시 좁힌다).
    if (user.frontOfficeRole && user.frontOfficeRole !== 'FINANCE_STAFF') {
      return 'TEAM_LEADER'
    }
    return 'OTHER'
  }
  if (user.role === 'COACHING_STAFF') {
    // 팀장 (감독) 만 편성 위저드 접근. 그 외 코칭 스태프는 뷰 없음.
    if (user.coachingRole === 'HEAD_COACH') return 'TEAM_LEADER'
    return 'OTHER'
  }
  return 'OTHER'
}

/**
 * 편성 워크플로우의 진입점 페이지.
 *
 * role + planStatus 를 기준으로 하위 slice (#427 Wizard, #429 FMReview, #432 GmApproval)
 * 중 하나를 렌더한다. 이번 PR (#428) 은 뱃지 + 라우팅 skeleton 만 담당하며,
 * 각 slice 는 병렬 PR 로 나뉘어 있어 아직 export 가 없다 (placeholder + TODO 유지).
 */
export function BudgetPlanPage({ seasonId }: Props) {
  const { user, loading: userLoading } = useCurrentUser()
  const [planStatus, setPlanStatus] = useState<BudgetPlanStatus | null>(null)
  const [reportLoading, setReportLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setReportLoading(true)
    financialReportApi
      .get(seasonId)
      .then((report) => {
        if (cancelled) return
        // 서버 응답에 planStatus 가 포함돼 있으나 legacy interface 로 인해 좁혀서 읽는다.
        const withStatus = report as unknown as FinancialReportWithPlanStatus
        setPlanStatus(withStatus.planStatus ?? 'DRAFT')
      })
      .catch(() => {
        if (!cancelled) setPlanStatus(null)
      })
      .finally(() => {
        if (!cancelled) setReportLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [seasonId])

  if (userLoading || reportLoading) {
    return (
      <div className="p-6 space-y-4 max-w-3xl mx-auto">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <p className="text-sm text-muted-foreground">로그인이 필요합니다.</p>
      </div>
    )
  }

  if (planStatus === null) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <p className="text-sm text-muted-foreground">
          시즌 재무보고서를 불러오지 못했습니다.
        </p>
      </div>
    )
  }

  const persona = resolvePersona(user)

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <header className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">편성 워크플로우</h1>
        <PlanStatusBadge status={planStatus} />
      </header>

      {/*
        각 slice 는 별도 PR 로 진행되므로 이번 PR 은 place-holder + TODO 만 남긴다.
        #427 (Wizard) / #429 (FMReview) 는 병렬 개발 중이며 export 가 붙는 대로
        여기서 import 로 교체한다.
      */}
      {persona === 'TEAM_LEADER' && (
        // TODO(#427): <BudgetPlanWizard seasonId={seasonId} planStatus={planStatus} />
        <section
          data-persona="TEAM_LEADER"
          className="rounded-md border border-dashed p-4 text-sm text-muted-foreground"
        >
          팀장/부서장 편성 위저드 (준비 중)
        </section>
      )}

      {persona === 'FINANCE_MANAGER' && (
        // TODO(#429): <FinanceManagerReview seasonId={seasonId} planStatus={planStatus} />
        <section
          data-persona="FINANCE_MANAGER"
          className="rounded-md border border-dashed p-4 text-sm text-muted-foreground"
        >
          재무담당 심사 화면 (준비 중)
        </section>
      )}

      {persona === 'GM' && (
        // #432 GM 재편성 지시 패널. 확정된 편성만 재편성 트리거 가능하며,
        // 그 외 상태 (승인 대기 등) UI 는 별도 slice 에서 붙는다.
        <GmReplanPanel seasonId={seasonId} planStatus={planStatus} />
      )}

      {persona === 'ADMIN' && (
        <section
          data-persona="ADMIN"
          className="rounded-md border p-4 text-sm text-muted-foreground"
        >
          시즌 {seasonId} 편성 상태: <strong>{planStatus}</strong>
        </section>
      )}

      {persona === 'OTHER' && (
        <section
          data-persona="OTHER"
          className="text-sm text-muted-foreground"
        >
          편성 워크플로우에 접근 권한이 없습니다.
        </section>
      )}
    </div>
  )
}
