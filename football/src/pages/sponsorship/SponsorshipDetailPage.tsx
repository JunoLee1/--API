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
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { DaumPostcodeDialog } from '@/components/DaumPostcodeDialog'

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatCurrency(n: number) {
  return n.toLocaleString('ko-KR') + '원'
}

// ── Bank Edit Dialog ──────────────────────────────────────────────────────────
interface SponsorInfoEditDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  sponsorship: Sponsorship
  onSaved: (updated: Sponsorship) => void
}

function SponsorInfoEditDialog({ open, onOpenChange, sponsorship, onSaved }: SponsorInfoEditDialogProps) {
  const { t } = useTranslation('sponsorship')
  const [isOverseas, setIsOverseas] = useState(sponsorship.isOverseas)
  const [businessRegNumber, setBusinessRegNumber] = useState(sponsorship.businessRegNumber ?? '')
  const [postalCode, setPostalCode] = useState(sponsorship.postalCode ?? '')
  const [address, setAddress] = useState(sponsorship.address ?? '')
  const [addressDetail, setAddressDetail] = useState(sponsorship.addressDetail ?? '')
  const [taxId, setTaxId] = useState(sponsorship.taxId ?? '')
  const [overseasAddress, setOverseasAddress] = useState(sponsorship.overseasAddress ?? '')
  const [domesticBankName, setDomesticBankName] = useState(sponsorship.domesticBankName ?? '')
  const [domesticAccountNumber, setDomesticAccountNumber] = useState(sponsorship.domesticAccountNumber ?? '')
  const [domesticAccountHolder, setDomesticAccountHolder] = useState(sponsorship.domesticAccountHolder ?? '')
  const [ukBankName, setUkBankName] = useState(sponsorship.ukBankName ?? '')
  const [ukSortCode, setUkSortCode] = useState(sponsorship.ukSortCode ?? '')
  const [ukAccountNumber, setUkAccountNumber] = useState(sponsorship.ukAccountNumber ?? '')
  const [ukSwiftBic, setUkSwiftBic] = useState(sponsorship.ukSwiftBic ?? '')
  const [showPostcode, setShowPostcode] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setIsOverseas(sponsorship.isOverseas)
      setBusinessRegNumber(sponsorship.businessRegNumber ?? '')
      setPostalCode(sponsorship.postalCode ?? '')
      setAddress(sponsorship.address ?? '')
      setAddressDetail(sponsorship.addressDetail ?? '')
      setTaxId(sponsorship.taxId ?? '')
      setOverseasAddress(sponsorship.overseasAddress ?? '')
      setDomesticBankName(sponsorship.domesticBankName ?? '')
      setDomesticAccountNumber(sponsorship.domesticAccountNumber ?? '')
      setDomesticAccountHolder(sponsorship.domesticAccountHolder ?? '')
      setUkBankName(sponsorship.ukBankName ?? '')
      setUkSortCode(sponsorship.ukSortCode ?? '')
      setUkAccountNumber(sponsorship.ukAccountNumber ?? '')
      setUkSwiftBic(sponsorship.ukSwiftBic ?? '')
      setShowPostcode(false)
    }
  }, [open, sponsorship])

  const handleSave = async () => {
    setSaving(true)
    try {
      const updated = await sponsorshipApi.update(sponsorship.id, {
        isOverseas,
        ...(!isOverseas && businessRegNumber ? { businessRegNumber } : { businessRegNumber: null }),
        ...(!isOverseas && postalCode ? { postalCode } : { postalCode: null }),
        ...(!isOverseas && address ? { address } : { address: null }),
        ...(!isOverseas && addressDetail ? { addressDetail } : { addressDetail: null }),
        ...(!isOverseas && domesticBankName ? { domesticBankName } : { domesticBankName: null }),
        ...(!isOverseas && domesticAccountNumber ? { domesticAccountNumber } : { domesticAccountNumber: null }),
        ...(!isOverseas && domesticAccountHolder ? { domesticAccountHolder } : { domesticAccountHolder: null }),
        ...(isOverseas && taxId ? { taxId } : { taxId: null }),
        ...(isOverseas && overseasAddress ? { overseasAddress } : { overseasAddress: null }),
        ...(isOverseas && ukBankName ? { ukBankName } : { ukBankName: null }),
        ...(isOverseas && ukSortCode ? { ukSortCode } : { ukSortCode: null }),
        ...(isOverseas && ukAccountNumber ? { ukAccountNumber } : { ukAccountNumber: null }),
        ...(isOverseas && ukSwiftBic ? { ukSwiftBic } : { ukSwiftBic: null }),
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{t('bank.editTitle')}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-1">
          {/* 국내/해외 구분 */}
          <div className="space-y-1.5">
            <Label>{t('form.origin')}</Label>
            <RadioGroup
              value={isOverseas ? 'overseas' : 'domestic'}
              onValueChange={(v) => {
                const switchToOverseas = v === 'overseas'
                setIsOverseas(switchToOverseas)
                if (switchToOverseas) {
                  setBusinessRegNumber('')
                  setPostalCode('')
                  setAddress('')
                  setAddressDetail('')
                  setDomesticBankName('')
                  setDomesticAccountNumber('')
                  setDomesticAccountHolder('')
                } else {
                  setTaxId('')
                  setOverseasAddress('')
                  setUkBankName('')
                  setUkSortCode('')
                  setUkAccountNumber('')
                  setUkSwiftBic('')
                }
              }}
            >
              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <RadioGroupItem value="domestic" />
                  {t('form.domestic')}
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <RadioGroupItem value="overseas" />
                  {t('form.overseas')}
                </label>
              </div>
            </RadioGroup>
          </div>

          {/* 국내 전용 */}
          {!isOverseas && (
            <>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">{t('form.businessRegNumber')}</Label>
                <Input placeholder="000-00-00000" value={businessRegNumber} onChange={(e) => setBusinessRegNumber(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">{t('form.address')}</Label>
                <div className="flex gap-2">
                  <Input readOnly placeholder={t('form.postalCode')} value={postalCode} className="w-28" />
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowPostcode(true)}>
                    {t('form.addressSearch')}
                  </Button>
                </div>
                <Input readOnly value={address} />
                <Input placeholder={t('form.addressDetail')} value={addressDetail} onChange={(e) => setAddressDetail(e.target.value)} />
              </div>
              <div>
                <p className="text-xs font-medium mb-2">{t('bank.domestic')}</p>
                <div className="space-y-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{t('bank.bankName')}</Label>
                    <Input value={domesticBankName} onChange={(e) => setDomesticBankName(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{t('bank.accountNumber')}</Label>
                    <Input value={domesticAccountNumber} onChange={(e) => setDomesticAccountNumber(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{t('bank.accountHolder')}</Label>
                    <Input value={domesticAccountHolder} onChange={(e) => setDomesticAccountHolder(e.target.value)} />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* 해외 전용 */}
          {isOverseas && (
            <>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">{t('form.taxId')}</Label>
                <Input placeholder="GB123456789" value={taxId} onChange={(e) => setTaxId(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">{t('form.overseasAddress')}</Label>
                <Textarea
                  placeholder="10 Downing Street, London, UK"
                  value={overseasAddress}
                  onChange={(e) => setOverseasAddress(e.target.value)}
                  rows={3}
                />
              </div>
              <div>
                <p className="text-xs font-medium mb-2">{t('bank.uk')}</p>
                <div className="space-y-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{t('bank.bankName')}</Label>
                    <Input value={ukBankName} onChange={(e) => setUkBankName(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{t('bank.sortCode')}</Label>
                      <Input value={ukSortCode} onChange={(e) => setUkSortCode(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{t('bank.accountNumber')}</Label>
                      <Input value={ukAccountNumber} onChange={(e) => setUkAccountNumber(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{t('bank.swiftBic')}</Label>
                    <Input value={ukSwiftBic} onChange={(e) => setUkSwiftBic(e.target.value)} />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <DaumPostcodeDialog
          open={showPostcode}
          onOpenChange={setShowPostcode}
          onComplete={(pc, addr) => {
            setPostalCode(pc)
            setAddress(addr)
          }}
        />

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
        <SponsorInfoEditDialog
          open={bankEditOpen}
          onOpenChange={setBankEditOpen}
          sponsorship={sponsorship}
          onSaved={(updated) => setSponsorship(updated)}
        />
      )}
    </div>
  )
}
