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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { ArrowLeft } from 'lucide-react'

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatCurrency(n: number) {
  return n.toLocaleString('ko-KR') + '원'
}

// ── Bank Edit Dialog ──────────────────────────────────────────────────────────
interface BankEditDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  sponsorship: Sponsorship
  onSaved: (updated: Sponsorship) => void
}

function BankEditDialog({ open, onOpenChange, sponsorship, onSaved }: BankEditDialogProps) {
  const { t } = useTranslation('sponsorship')
  const [form, setForm] = useState({
    domesticBankName: sponsorship.domesticBankName ?? '',
    domesticAccountNumber: sponsorship.domesticAccountNumber ?? '',
    domesticAccountHolder: sponsorship.domesticAccountHolder ?? '',
    ukBankName: sponsorship.ukBankName ?? '',
    ukSortCode: sponsorship.ukSortCode ?? '',
    ukAccountNumber: sponsorship.ukAccountNumber ?? '',
    ukSwiftBic: sponsorship.ukSwiftBic ?? '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setForm({
        domesticBankName: sponsorship.domesticBankName ?? '',
        domesticAccountNumber: sponsorship.domesticAccountNumber ?? '',
        domesticAccountHolder: sponsorship.domesticAccountHolder ?? '',
        ukBankName: sponsorship.ukBankName ?? '',
        ukSortCode: sponsorship.ukSortCode ?? '',
        ukAccountNumber: sponsorship.ukAccountNumber ?? '',
        ukSwiftBic: sponsorship.ukSwiftBic ?? '',
      })
    }
  }, [open, sponsorship])

  const handleSave = async () => {
    setSaving(true)
    try {
      const updated = await sponsorshipApi.update(sponsorship.id, {
        domesticBankName: form.domesticBankName || undefined,
        domesticAccountNumber: form.domesticAccountNumber || undefined,
        domesticAccountHolder: form.domesticAccountHolder || undefined,
        ukBankName: form.ukBankName || undefined,
        ukSortCode: form.ukSortCode || undefined,
        ukAccountNumber: form.ukAccountNumber || undefined,
        ukSwiftBic: form.ukSwiftBic || undefined,
      })
      toast.success(t('bank.saved'))
      onSaved(updated)
      onOpenChange(false)
    } catch {
      toast.error(t('bank.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const field = (label: string, key: keyof typeof form) => (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input value={form[key]} onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))} />
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{t('bank.editTitle')}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-1">
          <div>
            <p className="text-xs font-medium mb-2">{t('bank.domestic')}</p>
            <div className="space-y-2">
              {field(t('bank.bankName'), 'domesticBankName')}
              {field(t('bank.accountNumber'), 'domesticAccountNumber')}
              {field(t('bank.accountHolder'), 'domesticAccountHolder')}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium mb-2">{t('bank.uk')}</p>
            <div className="space-y-2">
              {field(t('bank.bankName'), 'ukBankName')}
              <div className="grid grid-cols-2 gap-2">
                {field(t('bank.sortCode'), 'ukSortCode')}
                {field(t('bank.accountNumber'), 'ukAccountNumber')}
              </div>
              {field(t('bank.swiftBic'), 'ukSwiftBic')}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>취소</Button>
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? '저장 중...' : t('bank.editButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
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
  const [bankEditOpen, setBankEditOpen] = useState(false)

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

          {/* 계좌 정보 섹션 */}
          <div className="px-6 py-4 border-b">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium">{t('bank.sectionTitle')}</h2>
              {canWrite && (
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setBankEditOpen(true)}>
                  {t('bank.editButton')}
                </Button>
              )}
            </div>
            {!sponsorship.domesticBankName && !sponsorship.ukBankName ? (
              <p className="text-xs text-muted-foreground">{t('bank.noInfo')}</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                {sponsorship.domesticBankName && (
                  <div>
                    <p className="text-xs text-muted-foreground font-medium mb-1">{t('bank.domestic')}</p>
                    <p>{sponsorship.domesticBankName}</p>
                    {sponsorship.domesticAccountNumber && <p className="tabular-nums text-muted-foreground">{sponsorship.domesticAccountNumber}</p>}
                    {sponsorship.domesticAccountHolder && <p className="text-muted-foreground">{sponsorship.domesticAccountHolder}</p>}
                  </div>
                )}
                {sponsorship.ukBankName && (
                  <div>
                    <p className="text-xs text-muted-foreground font-medium mb-1">{t('bank.uk')}</p>
                    <p>{sponsorship.ukBankName}</p>
                    {sponsorship.ukSortCode && <p className="tabular-nums text-muted-foreground">{t('bank.sortCode')}: {sponsorship.ukSortCode}</p>}
                    {sponsorship.ukAccountNumber && <p className="tabular-nums text-muted-foreground">{sponsorship.ukAccountNumber}</p>}
                    {sponsorship.ukSwiftBic && <p className="text-muted-foreground">SWIFT: {sponsorship.ukSwiftBic}</p>}
                  </div>
                )}
              </div>
            )}
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

      {sponsorship && (
        <BankEditDialog
          open={bankEditOpen}
          onOpenChange={setBankEditOpen}
          sponsorship={sponsorship}
          onSaved={(updated) => setSponsorship(updated)}
        />
      )}
    </div>
  )
}
