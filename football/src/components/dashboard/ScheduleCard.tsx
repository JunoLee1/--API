import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export interface ScheduleItem {
  id: string | number
  label: string
  date: string
}

interface Props {
  items: ScheduleItem[]
  loading: boolean
}

function formatDateTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', weekday: 'short' })
}

export function ScheduleCard({ items, loading }: Props) {
  const { t } = useTranslation('common')

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{t('dashboard.schedule.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">{t('dashboard.schedule.loading')}</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('dashboard.schedule.empty')}</p>
        ) : (
          <ul className="space-y-2">
            {items.slice(0, 3).map((item) => (
              <li key={item.id} className="flex justify-between items-center gap-2">
                <p className="text-sm truncate">{item.label}</p>
                <span className="text-xs text-muted-foreground shrink-0">
                  {formatDateTime(item.date)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
