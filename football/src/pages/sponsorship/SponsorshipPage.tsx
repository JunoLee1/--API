import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { sponsorshipApi } from '@/services/sponsorship.service'
import type {
  Sponsorship,
  SponsorshipPayment,
  SponsorType,
  PaymentSchedule,
  CreateSponsorshipDto,
} from '@/types/sponsorship'
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
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Plus, ChevronDown, ChevronRight } from 'lucide-react'

const SPONSOR_TYPES: SponsorType[] = ['TITLE', 'KIT', 'STADIUM_NAMING', 'DIGITAL', 'OTHER']
const PAYMENT_SCHEDULES: PaymentSchedule[] = ['MONTHLY', 'QUARTERLY', 'ANNUAL']

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatCurrency(n: number) {
  return n.toLocaleString('ko-KR') + '원'
}

// ── Create Dialog ─────────────────────────────────────────────────────────────
interface CreateSponsorshipDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSaved: () => void
}

function CreateSponsorshipDialog({ open, onOpenChange, onSaved }: CreateSponsorshipDialogProps) {
  const { t } = useTranslation('sponsorship')
  const [sponsorName, setSponsorName] = useState('')
  const [type, setType] = useState<SponsorType>('TITLE')
  const [totalFee, setTotalFee] = useState('')
  const [contractStart, setContractStart] = useState('')
  const [contractEnd, setContractEnd] = useState('')
  const [paymentSchedule, setPaymentSchedule] = useState<PaymentSchedule>('ANNUAL')
  const [saving, setSaving] = useState(false)

  const reset = () => {
    setSponsorName('')
    setType('TITLE')
    setTotalFee('')
    setContractStart('')
    setContractEnd('')
    setPaymentSchedule('ANNUAL')
  }

  const handleSave = async () => {
    if (!sponsorName.trim()) { toast.error('스폰서명을 입력하세요'); return }
    if (!totalFee || Number(totalFee) <= 0) { toast.error('계약금액을 입력하세요'); return }
    if (!contractStart) { toast.error('계약 시작일을 입력하세요'); return }
    if (!contractEnd) { toast.error('계약 종료일을 입력하세요'); return }
    if (contractEnd <= contractStart) { toast.error('계약 종료일은 시작일보다 이후여야 합니다'); return }

    setSaving(true)
    try {
      const dto: CreateSponsorshipDto = {
        sponsorName: sponsorName.trim(),
        type,
        totalFee: Number(totalFee),
        contractStart,
        contractEnd,
        paymentSchedule,
      }
      await sponsorshipApi.create(dto)
      toast.success(t('created'))
      onSaved()
      onOpenChange(false)
      reset()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('createFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('form.title')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t('form.sponsorName')}</Label>
            <Input
              placeholder={t('form.sponsorNamePlaceholder')}
              value={sponsorName}
              onChange={(e) => setSponsorName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t('form.type')}</Label>
            <Select value={type} onValueChange={(v) => setType(v as SponsorType)}>
              <SelectTrigger><SelectValue>{SPONSOR_TYPE_LABEL[type]}</SelectValue></SelectTrigger>
              <SelectContent>
                {SPONSOR_TYPES.map((tp) => (
                  <SelectItem key={tp} value={tp}>{SPONSOR_TYPE_LABEL[tp]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t('form.totalFee')}</Label>
            <Input
              type="number"
              placeholder="0"
              value={totalFee}
              onChange={(e) => setTotalFee(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t('form.contractStart')}</Label>
              <Input
                type="date"
                value={contractStart}
                onChange={(e) => setContractStart(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('form.contractEnd')}</Label>
              <Input
                type="date"
                value={contractEnd}
                onChange={(e) => setContractEnd(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t('form.paymentSchedule')}</Label>
            <Select value={paymentSchedule} onValueChange={(v) => setPaymentSchedule(v as PaymentSchedule)}>
              <SelectTrigger><SelectValue>{PAYMENT_SCHEDULE_LABEL[paymentSchedule]}</SelectValue></SelectTrigger>
              <SelectContent>
                {PAYMENT_SCHEDULES.map((s) => (
                  <SelectItem key={s} value={s}>{PAYMENT_SCHEDULE_LABEL[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            취소
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? '저장 중...' : '등록'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Payment Row ───────────────────────────────────────────────────────────────
interface PaymentRowProps {
  payment: SponsorshipPayment
  canWrite: boolean
  onMarkPaid: (paymentId: number) => void
}

function PaymentRow({ payment, canWrite, onMarkPaid }: PaymentRowProps) {
  const { t } = useTranslation('sponsorship')
  return (
    <TableRow className="bg-muted/30">
      <TableCell className="pl-10 tabular-nums text-sm text-muted-foreground">
        {formatDate(payment.dueDate)}
      </TableCell>
      <TableCell className="text-sm tabular-nums">{formatCurrency(payment.amount)}</TableCell>
      <TableCell>
        <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs ${PAYMENT_STATUS_STYLE[payment.status]}`}>
          {PAYMENT_STATUS_LABEL[payment.status]}
        </span>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground tabular-nums">
        {payment.paidAt ? formatDate(payment.paidAt) : '—'}
      </TableCell>
      <TableCell>
        {canWrite && payment.status !== 'PAID' && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => onMarkPaid(payment.id)}
          >
            {t('payment.markPaid')}
          </Button>
        )}
      </TableCell>
    </TableRow>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export function SponsorshipPage() {
  const { t } = useTranslation('sponsorship')
  const { user } = useCurrentUser()
  const canWrite =
    user?.role === 'ADMIN' ||
    (user?.role === 'FRONT_OFFICE' &&
      (user.frontOfficeRole === 'FINANCE_MANAGER' ||
        user.frontOfficeRole === 'FINANCE_STAFF' ||
        user.frontOfficeRole === 'GM'))

  const [sponsorships, setSponsorships] = useState<Sponsorship[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState<SponsorType | ''>('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [showCreate, setShowCreate] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [payments, setPayments] = useState<Record<number, SponsorshipPayment[]>>({})
  const [paymentsLoading, setPaymentsLoading] = useState<Record<number, boolean>>({})

  const fetchSponsorships = useCallback(() => {
    setLoading(true)
    sponsorshipApi.list({ type: typeFilter || undefined, page })
      .then((res) => {
        setSponsorships(res.data)
        setTotalPages(res.totalPages)
      })
      .catch(() => toast.error(t('loadFailed')))
      .finally(() => setLoading(false))
  }, [t, typeFilter, page])

  useEffect(() => { fetchSponsorships() }, [fetchSponsorships])

  const handleTypeFilter = (v: string) => {
    setTypeFilter(v as SponsorType | '')
    setPage(1)
    setExpandedId(null)
  }

  const toggleExpand = async (sp: Sponsorship) => {
    if (expandedId === sp.id) {
      setExpandedId(null)
      return
    }
    setExpandedId(sp.id)
    if (!payments[sp.id]) {
      setPaymentsLoading((prev) => ({ ...prev, [sp.id]: true }))
      try {
        const data = await sponsorshipApi.getPayments(sp.id)
        setPayments((prev) => ({ ...prev, [sp.id]: data }))
      } catch {
        toast.error('납부 내역을 불러오지 못했습니다.')
      } finally {
        setPaymentsLoading((prev) => ({ ...prev, [sp.id]: false }))
      }
    }
  }

  const handleMarkPaid = async (sponsorshipId: number, paymentId: number) => {
    try {
      const updated = await sponsorshipApi.markPaid(sponsorshipId, paymentId)
      setPayments((prev) => ({
        ...prev,
        [sponsorshipId]: prev[sponsorshipId].map((p) => (p.id === paymentId ? updated : p)),
      }))
      toast.success(t('markedPaid'))
    } catch {
      toast.error(t('markPaidFailed'))
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 shrink-0 flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">{t('title')}</h1>
        {canWrite && (
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-1" />{t('addButton')}
          </Button>
        )}
      </div>

      <div className="px-6 py-3 border-b shrink-0">
        <Select value={typeFilter} onValueChange={handleTypeFilter}>
          <SelectTrigger className="w-36 h-8 text-sm">
            <SelectValue>
              {typeFilter ? SPONSOR_TYPE_LABEL[typeFilter] : t('filterAll')}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">{t('filterAll')}</SelectItem>
            {SPONSOR_TYPES.map((tp) => (
              <SelectItem key={tp} value={tp}>{SPONSOR_TYPE_LABEL[tp]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : sponsorships.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
            {t('noData')}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-8" />
                <TableHead>{t('col.sponsorName')}</TableHead>
                <TableHead className="w-32">{t('col.type')}</TableHead>
                <TableHead className="w-36 tabular-nums">{t('col.totalFee')}</TableHead>
                <TableHead className="w-24">{t('col.schedule')}</TableHead>
                <TableHead className="w-28 tabular-nums">{t('col.contractStart')}</TableHead>
                <TableHead className="w-28 tabular-nums">{t('col.contractEnd')}</TableHead>
                <TableHead className="w-24 text-muted-foreground">{t('col.createdBy')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sponsorships.map((sp) => (
                <>
                  <TableRow
                    key={sp.id}
                    className="cursor-pointer"
                    onClick={() => void toggleExpand(sp)}
                  >
                    <TableCell className="w-8 text-muted-foreground">
                      {expandedId === sp.id
                        ? <ChevronDown className="h-4 w-4" />
                        : <ChevronRight className="h-4 w-4" />}
                    </TableCell>
                    <TableCell className="font-medium">{sp.sponsorName}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs ${SPONSOR_TYPE_STYLE[sp.type]}`}>
                        {SPONSOR_TYPE_LABEL[sp.type]}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">{formatCurrency(sp.totalFee)}</TableCell>
                    <TableCell className="text-sm">{PAYMENT_SCHEDULE_LABEL[sp.paymentSchedule]}</TableCell>
                    <TableCell className="text-sm tabular-nums text-muted-foreground">{formatDate(sp.contractStart)}</TableCell>
                    <TableCell className="text-sm tabular-nums text-muted-foreground">{formatDate(sp.contractEnd)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{sp.createdBy.username}</TableCell>
                  </TableRow>

                  {expandedId === sp.id && (
                    paymentsLoading[sp.id] ? (
                      <TableRow key={`${sp.id}-loading`} className="bg-muted/30">
                        <TableCell colSpan={8} className="py-4">
                          <div className="pl-8 space-y-2">
                            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : !payments[sp.id]?.length ? (
                      <TableRow key={`${sp.id}-empty`} className="bg-muted/30">
                        <TableCell colSpan={8} className="py-4 pl-10 text-sm text-muted-foreground">
                          {t('payment.noData')}
                        </TableCell>
                      </TableRow>
                    ) : (
                      <>
                        <TableRow key={`${sp.id}-header`} className="bg-muted/50 hover:bg-muted/50">
                          <TableCell />
                          <TableCell className="text-xs font-medium text-muted-foreground pl-10">{t('payment.dueDate')}</TableCell>
                          <TableCell className="text-xs font-medium text-muted-foreground">{t('payment.amount')}</TableCell>
                          <TableCell className="text-xs font-medium text-muted-foreground">{t('payment.status')}</TableCell>
                          <TableCell className="text-xs font-medium text-muted-foreground">{t('payment.paidAt')}</TableCell>
                          <TableCell colSpan={4} />
                        </TableRow>
                        {payments[sp.id].map((pmt) => (
                          <PaymentRow
                            key={pmt.id}
                            payment={pmt}
                            canWrite={canWrite}
                            onMarkPaid={(paymentId) => void handleMarkPaid(sp.id, paymentId)}
                          />
                        ))}
                      </>
                    )
                  )}
                </>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="border-t px-6 py-3 shrink-0 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              이전
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              다음
            </Button>
          </div>
        </div>
      )}

      <CreateSponsorshipDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onSaved={() => { fetchSponsorships(); setExpandedId(null) }}
      />
    </div>
  )
}
