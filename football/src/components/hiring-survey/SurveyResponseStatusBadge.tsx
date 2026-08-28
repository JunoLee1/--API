import { Badge } from '@/components/ui/badge'
import {
  RESPONSE_STATUS_BADGE_CLASSES,
  RESPONSE_STATUS_LABELS,
  type SurveyResponseStatus,
} from '@/types/hiring-survey'

interface Props {
  status: SurveyResponseStatus
  className?: string
}

/**
 * Colored status badge for `SurveyResponse` — reuses the color/label tuples
 * from `hiring-survey.ts` so all consumers stay in sync.
 */
export function SurveyResponseStatusBadge({ status, className }: Props) {
  const colorClass = RESPONSE_STATUS_BADGE_CLASSES[status]
  return (
    <Badge className={`${colorClass} ${className ?? ''}`.trim()}>
      {RESPONSE_STATUS_LABELS[status]}
    </Badge>
  )
}
