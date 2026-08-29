import {
  AlertTriangle,
  CheckCircle2,
  ClockAlert,
  FileText,
  RefreshCw,
  UserCheck,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { BudgetPlanStatus } from '@/services/budget-plan.service'

interface Props {
  status: BudgetPlanStatus
  className?: string
}

/**
 * 상태별 뱃지 스타일 정의.
 *
 * `variant='outline'` 을 기본으로 두고 색상은 tailwind 유틸로 오버라이드한다.
 * shadcn Badge 의 default variants (default/secondary/destructive/outline/ghost/link)
 * 만으로는 7 색 팔레트를 표현할 수 없어 CategoryEditor 의 SCOPE_BADGE_CLASS 패턴을
 * 그대로 따랐다 (색상 hex 대신 tailwind 색상 이름 사용).
 *
 * 다국어화: 이 컴포넌트는 편성 워크플로우 slice (#428) 의 일부로,
 * 병렬 slice 인 #427 (Wizard) 이 하드코딩 한국어를 사용하므로 동일 관례를
 * 유지한다. i18n 도입 시 라벨 맵만 t() 로 교체하면 된다.
 */
interface StatusConfig {
  label: string
  icon: LucideIcon
  className: string
}

const STATUS_CONFIG: Record<BudgetPlanStatus, StatusConfig> = {
  DRAFT: {
    label: '초안',
    icon: FileText,
    className:
      'bg-gray-100 text-gray-900 border-gray-300 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700',
  },
  CAPACITY_FAILED: {
    label: '예산 부족',
    icon: AlertTriangle,
    className:
      'bg-red-100 text-red-900 border-red-300 dark:bg-red-950 dark:text-red-100 dark:border-red-800',
  },
  AWAITING_REVIEW: {
    label: '심사 창 개방',
    icon: ClockAlert,
    className:
      'bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950 dark:text-blue-100 dark:border-blue-800',
  },
  KNAPSACK_EXECUTED: {
    label: 'Knapsack 실행 완료',
    icon: Zap,
    className:
      'bg-indigo-100 text-indigo-900 border-indigo-300 dark:bg-indigo-950 dark:text-indigo-100 dark:border-indigo-800',
  },
  AWAITING_GM_APPROVAL: {
    label: 'GM 승인 대기',
    icon: UserCheck,
    className:
      'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-100 dark:border-amber-800',
  },
  FINALIZED: {
    label: '확정',
    icon: CheckCircle2,
    className:
      'bg-green-100 text-green-900 border-green-300 dark:bg-green-950 dark:text-green-100 dark:border-green-800',
  },
  RE_PLANNING: {
    label: '재편성 중',
    icon: RefreshCw,
    className:
      'bg-orange-100 text-orange-900 border-orange-300 dark:bg-orange-950 dark:text-orange-100 dark:border-orange-800',
  },
}

/**
 * FinancialReport.planStatus 를 시각화하는 뱃지.
 *
 * 7 상태 (DRAFT / CAPACITY_FAILED / AWAITING_REVIEW / KNAPSACK_EXECUTED /
 *          AWAITING_GM_APPROVAL / FINALIZED / RE_PLANNING) 각각에 대해
 * 배경색, 아이콘, 한국어 라벨을 매핑한다. `data-plan-status` 속성으로
 * 테스트에서 상태를 조회할 수 있다.
 *
 * `className` 은 shadcn 관례대로 pass-through (cn 으로 후위 merge).
 */
export function PlanStatusBadge({ status, className }: Props) {
  const config = STATUS_CONFIG[status]
  const Icon = config.icon
  return (
    <Badge
      variant="outline"
      className={cn(config.className, className)}
      data-plan-status={status}
    >
      <Icon aria-hidden="true" />
      <span>{config.label}</span>
    </Badge>
  )
}
