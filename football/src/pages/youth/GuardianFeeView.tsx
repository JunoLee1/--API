import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { guardianApi } from '@/services/guardian.service'
import { PaymentModal } from '@/components/youth/PaymentModal'
import type { AcademyFee } from '@/types/academy-fee'

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  PENDING: 'outline', SUBMITTED: 'secondary', PAID: 'default', OVERDUE: 'destructive', LOCKED: 'destructive'
}

interface Props { playerId: string }

export function GuardianFeeView({ playerId }: Props) {
  const { t } = useTranslation('youth')
  const [fees, setFees] = useState<AcademyFee[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedFee, setSelectedFee] = useState<AcademyFee | null>(null)

  useEffect(() => {
    guardianApi.getFees(playerId).then(setFees).finally(() => setLoading(false))
  }, [playerId])

  const handlePaid = (updated: AcademyFee) => {
    setFees(prev => prev.map(f => f.id === updated.id ? updated : f))
  }

  if (loading) return <p className="text-muted-foreground">{t('guardianFeeView.loading')}</p>

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">{t('guardianFeeView.title')}</h2>
      {fees.map(fee => (
        <div key={fee.id} className="border rounded-lg p-4 flex items-center justify-between">
          <div>
            <p className="font-medium">{fee.year}년 {fee.month}월</p>
            <p className="text-sm text-muted-foreground">{fee.amount.toLocaleString()}원 · 기한: {new Date(fee.dueDate).toLocaleDateString('ko-KR')}</p>
            {fee.status === 'SUBMITTED' && <p className="text-xs text-blue-500 mt-1">{t('guardianFeeView.proofPending')}</p>}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={STATUS_VARIANT[fee.status]}>{t(`guardianFeeView.status.${fee.status}`)}</Badge>
            {(fee.status === 'PENDING' || fee.status === 'OVERDUE') && (
              <Button size="sm" onClick={() => setSelectedFee(fee)}>
                {t('guardianFeeView.submitProof')}
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
        </div>
      ))}
      {fees.length === 0 && <p className="text-muted-foreground">{t('guardianFeeView.noData')}</p>}

      {selectedFee && (
        <PaymentModal
          fee={selectedFee}
          userId={selectedFee.guardianId}
          open={!!selectedFee}
          onClose={() => setSelectedFee(null)}
          onPaid={handlePaid}
        />
      )}
    </div>
  )
}
