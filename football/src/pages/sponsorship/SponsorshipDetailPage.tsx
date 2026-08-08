import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { sponsorshipApi } from '@/services/sponsorship.service'
import type { Sponsorship, SponsorshipPayment } from '@/types/sponsorship'
import {
  SPONSOR_TYPE_LABEL,
  SPONSOR_TYPE_STYLE,
  PAYMENT_SCHEDULE_LABEL,
  PAYMENT_STATUS_LABEL,
  PAYMENT_STATUS_STYLE,
} from '@/types/sponsorship'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ArrowLeft } from 'lucide-react'

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatCurrency(n: number) {
  return n.toLocaleString('ko-KR') + '원'
}

export function SponsorshipDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation('sponsorship')
  const { user } = useCurrentUser()
  const canWrite =
    user?.role === 'ADMIN' ||
    (user?.role === 'FRONT_OFFICE' &&
      (user.frontOfficeRole === 'FINANCE_MANAGER' ||
        user.frontOfficeRole === 'FINANCE_STAFF' ||
        user.frontOfficeRole === 'GM'))

  const [sponsorship, setSponsorship] = useState<Sponsorship | null>(null)
  const [payments, setPayments] = useState<SponsorshipPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [paymentsLoading, setPaymentsLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    const numId = Number(id)
    setLoading(true)
    setPaymentsLoading(true)
    sponsorshipApi.get(numId)
      .then(setSponsorship)
      .catch(() => toast.error(t('loadFailed')))
      .finally(() => setLoading(false))
    sponsorshipApi.getPayments(numId)
      .then(setPayments)
      .catch(() => toast.error('납부 내역을 불러오지 못했습니다.'))
      .finally(() => setPaymentsLoading(false))
  }, [id, t])

  const handleMarkPaid = async (paymentId: number) => {
    if (!id) return
    try {
      const updated = await sponsorshipApi.markPaid(Number(id), paymentId)
      setPayments((prev) => prev.map((p) => (p.id === paymentId ? updated : p)))
      toast.success(t('markedPaid'))
    } catch {
      toast.error(t('markPaidFailed'))
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 shrink-0 flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/sponsorship')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        {loading ? (
          <Skeleton className="h-6 w-48" />
        ) : (
          <h1 className="text-lg font-semibold tracking-tight">{sponsorship?.sponsorName}</h1>
        )}
      </div>

      {loading ? (
        <div className="p-6 space-y-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
        </div>
      ) : sponsorship ? (
        <>
          <div className="px-6 py-5 border-b grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-4 text-sm">
            <div>
              <p className="text-muted-foreground text-xs mb-1">{t('col.type')}</p>
              <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs ${SPONSOR_TYPE_STYLE[sponsorship.type]}`}>
                {SPONSOR_TYPE_LABEL[sponsorship.type]}
              </span>
            </div>
            <div>
              <p className="text-muted-foreground text-xs mb-1">{t('col.totalFee')}</p>
              <p className="font-medium tabular-nums">{formatCurrency(sponsorship.totalFee)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs mb-1">{t('col.schedule')}</p>
              <p>{PAYMENT_SCHEDULE_LABEL[sponsorship.paymentSchedule]}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs mb-1">{t('col.contractStart')}</p>
              <p className="tabular-nums">{formatDate(sponsorship.contractStart)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs mb-1">{t('col.contractEnd')}</p>
              <p className="tabular-nums">{formatDate(sponsorship.contractEnd)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs mb-1">{t('col.createdBy')}</p>
              <p>{sponsorship.createdBy.username}</p>
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            <div className="px-6 pt-5 pb-2">
              <h2 className="text-sm font-medium">{t('payment.dueDate')} 스케줄</h2>
            </div>
            {paymentsLoading ? (
              <div className="px-6 space-y-2">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
              </div>
            ) : payments.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
                {t('payment.noData')}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>{t('payment.dueDate')}</TableHead>
                    <TableHead className="tabular-nums">{t('payment.amount')}</TableHead>
                    <TableHead>{t('payment.status')}</TableHead>
                    <TableHead className="tabular-nums">{t('payment.paidAt')}</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((pmt) => (
                    <TableRow key={pmt.id}>
                      <TableCell className="tabular-nums text-sm">{formatDate(pmt.dueDate)}</TableCell>
                      <TableCell className="tabular-nums text-sm">{formatCurrency(pmt.amount)}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs ${PAYMENT_STATUS_STYLE[pmt.status]}`}>
                          {PAYMENT_STATUS_LABEL[pmt.status]}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground tabular-nums">
                        {pmt.paidAt ? formatDate(pmt.paidAt) : '—'}
                      </TableCell>
                      <TableCell>
                        {canWrite && pmt.status !== 'PAID' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => void handleMarkPaid(pmt.id)}
                          >
                            {t('payment.markPaid')}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </>
      ) : (
        <div className="flex items-center justify-center flex-1 text-sm text-muted-foreground">
          스폰서십 정보를 찾을 수 없습니다.
        </div>
      )}
    </div>
  )
}
