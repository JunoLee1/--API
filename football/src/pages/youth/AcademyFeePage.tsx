import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { academyFeeApi } from '@/services/academyFee.service'
import type { AcademyFee } from '@/types/academy-fee'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Plus } from 'lucide-react'

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  PENDING: 'outline', SUBMITTED: 'secondary', PAID: 'default', OVERDUE: 'destructive', LOCKED: 'destructive'
}

const currentYear = new Date().getFullYear()
const currentMonth = new Date().getMonth() + 1

function IssueFeeDialog({ open, onOpenChange, onIssued }: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onIssued: () => void
}) {
  const [year, setYear] = useState(String(currentYear))
  const [month, setMonth] = useState(String(currentMonth))
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async () => {
    if (!year || !month || !amount) { toast.error('연도, 월, 금액을 모두 입력하세요.'); return }
    setSaving(true)
    try {
      await academyFeeApi.issue(Number(year), Number(month), Number(amount.replace(/,/g, '')))
      toast.success(`${year}년 ${month}월 회비가 등록됐습니다.`)
      onIssued()
      onOpenChange(false)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '회비 등록에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>월별 회비 등록</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="flex gap-2">
            <div className="flex-1 space-y-1.5">
              <Label>연도</Label>
              <Input type="number" value={year} onChange={e => setYear(e.target.value)} min={2020} max={2100} />
            </div>
            <div className="flex-1 space-y-1.5">
              <Label>월</Label>
              <Input type="number" value={month} onChange={e => setMonth(e.target.value)} min={1} max={12} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>청구 금액 (원)</Label>
            <Input
              type="text"
              inputMode="numeric"
              placeholder="예: 150,000"
              value={amount ? Number(amount.replace(/,/g, '')).toLocaleString('ko-KR') : ''}
              onChange={e => setAmount(e.target.value.replace(/[^0-9]/g, ''))}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>취소</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? '등록 중...' : '등록'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function AcademyFeePage() {
  const { t } = useTranslation('youth')
  const { user } = useCurrentUser()
  const [fees, setFees] = useState<AcademyFee[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('')
  const [submitting, setSubmitting] = useState<number | null>(null)
  const [issueOpen, setIssueOpen] = useState(false)

  const canApprove =
    user?.role === 'ADMIN' ||
    user?.role === 'SUPER_ADMIN' ||
    user?.role === 'GM' ||
    (user?.role === 'FRONT_OFFICE' && user.frontOfficeRole === 'HR_MANAGER')

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
        <div className="flex items-center gap-2">
          <div className="flex gap-2">
            {['', 'PENDING', 'SUBMITTED', 'OVERDUE', 'LOCKED'].map(s => (
              <Button key={s} size="sm" variant={filter === s ? 'default' : 'outline'} onClick={() => setFilter(s)}>
                {s ? t(`feePage.status.${s}`) : t('feePage.filterAll')}
              </Button>
            ))}
          </div>
          {canApprove && (
            <Button size="sm" onClick={() => setIssueOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              회비 등록
            </Button>
          )}
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
              {fee.status === 'SUBMITTED' && canApprove && (
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

      {canApprove && (
        <IssueFeeDialog
          open={issueOpen}
          onOpenChange={setIssueOpen}
          onIssued={load}
        />
      )}
    </div>
  )
}
