import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { academyFeeApi } from '@/services/academyFee.service'
import type { AcademyFee } from '@/types/academy-fee'

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  PENDING: 'outline', SUBMITTED: 'secondary', PAID: 'default', OVERDUE: 'destructive', LOCKED: 'destructive'
}

export default function AcademyFeePage() {
  const { t } = useTranslation('youth')
  const [fees, setFees] = useState<AcademyFee[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('')
  const [submitting, setSubmitting] = useState<number | null>(null)

  const load = () => {
    setLoading(true)
    academyFeeApi.getAll(filter ? { status: filter } : {}).then(setFees).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [filter])

  const handleApprove = async (id: number) => {
    await academyFeeApi.approve(id)
    load()
  }

  const handleAdminSubmit = async (id: number) => {
    setSubmitting(id)
    try {
      await academyFeeApi.adminSubmit(id)
      load()
    } finally {
      setSubmitting(null)
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t('feePage.title')}</h1>
        <div className="flex gap-2">
          {['', 'PENDING', 'SUBMITTED', 'OVERDUE', 'LOCKED'].map(s => (
            <Button key={s} size="sm" variant={filter === s ? 'default' : 'outline'} onClick={() => setFilter(s)}>
              {s ? t(`feePage.status.${s}`) : t('feePage.filterAll')}
            </Button>
          ))}
        </div>
      </div>
      {loading ? <p className="text-muted-foreground">{t('feePage.loading')}</p> : (
        <div className="space-y-2">
          {fees.map(fee => (
            <div key={fee.id} className="border rounded-lg p-4 flex items-center gap-4">
              <div className="flex-1">
                <p className="font-medium">{fee.player.playerName}</p>
                <p className="text-sm text-muted-foreground">
                  {fee.year}년 {fee.month}월 · {fee.amount.toLocaleString()}원 · {t('field.dueDate')} {new Date(fee.dueDate).toLocaleDateString('ko-KR')}
                </p>
                {fee.paymentProofUrl && (
                  <a href={fee.paymentProofUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 underline">{t('feePage.proofLink')}</a>
                )}
                {fee.paymentMethod && (
                  <span className="text-xs text-muted-foreground">
                    {fee.paymentMethod === 'PG' ? '카드/간편결제' : '계좌이체'}
                  </span>
                )}
              </div>
              <Badge variant={STATUS_VARIANT[fee.status]}>{t(`feePage.status.${fee.status}`)}</Badge>
              {fee.status === 'SUBMITTED' && (
                <Button size="sm" onClick={() => handleApprove(fee.id)}>{t('feePage.approveButton')}</Button>
              )}
              {['PENDING', 'OVERDUE'].includes(fee.status) && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void handleAdminSubmit(fee.id)}
                  disabled={submitting === fee.id}
                >
                  수동 접수
                </Button>
              )}
              {fee.status === 'PAID' && fee.receiptIssuedAt && (
                <a
                  href={`/academy-fees/${fee.id}/receipt`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-500 underline whitespace-nowrap"
                >
                  영수증
                </a>
              )}
            </div>
          ))}
          {fees.length === 0 && <p className="text-muted-foreground">{t('feePage.noData')}</p>}
        </div>
      )}
    </div>
  )
}
