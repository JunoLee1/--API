import { useTranslation } from 'react-i18next'
import type { AcademyFinanceStats } from '@/types/academy-fee'

interface Props { data: AcademyFinanceStats }

export function AcademyFinanceSection({ data }: Props) {
  const { t } = useTranslation('common')

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">{t('dashboard.academyFinance.title')}</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{data.monthlyCollectionRate}%</p>
          <p className="text-xs text-muted-foreground mt-1">{t('dashboard.academyFinance.monthlyRate')}</p>
        </div>
        <div className="rounded-lg border p-4 text-center">
          <p className="text-2xl font-bold">{data.totalRevenue.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-1">{t('dashboard.academyFinance.totalRevenue')}</p>
        </div>
        <div className="rounded-lg border p-4 text-center">
          <p className={`text-2xl font-bold ${data.overdueCount > 0 ? 'text-yellow-600' : ''}`}>{data.overdueCount}</p>
          <p className="text-xs text-muted-foreground mt-1">{t('dashboard.academyFinance.overdueCount')}</p>
        </div>
        <div className="rounded-lg border p-4 text-center">
          <p className={`text-2xl font-bold ${data.lockedPlayerCount > 0 ? 'text-red-600' : ''}`}>{data.lockedPlayerCount}</p>
          <p className="text-xs text-muted-foreground mt-1">{t('dashboard.academyFinance.lockedPlayers')}</p>
        </div>
      </div>
    </div>
  )
}
