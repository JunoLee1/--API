import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { sponsorshipApi } from '@/services/sponsorship.service'
import type {
  Sponsorship,
  SponsorType,
  PaymentSchedule,
  CreateSponsorshipDto,
  SponsorshipRoiSummary,
} from '@/types/sponsorship'
import {
  SPONSOR_TYPE_LABEL,
  SPONSOR_TYPE_STYLE,
  PAYMENT_SCHEDULE_LABEL,
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
import { Plus, TrendingUp, TrendingDown } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { DaumPostcodeDialog } from '@/components/DaumPostcodeDialog'

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
  const [domesticBankName, setDomesticBankName] = useState('')
  const [domesticAccountNumber, setDomesticAccountNumber] = useState('')
  const [domesticAccountHolder, setDomesticAccountHolder] = useState('')
  const [ukBankName, setUkBankName] = useState('')
  const [ukSortCode, setUkSortCode] = useState('')
  const [ukAccountNumber, setUkAccountNumber] = useState('')
  const [ukSwiftBic, setUkSwiftBic] = useState('')
  const [isOverseas, setIsOverseas] = useState(false)
  const [businessRegNumber, setBusinessRegNumber] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [address, setAddress] = useState('')
  const [addressDetail, setAddressDetail] = useState('')
  const [taxId, setTaxId] = useState('')
  const [overseasAddress, setOverseasAddress] = useState('')
  const [showPostcode, setShowPostcode] = useState(false)
  const [saving, setSaving] = useState(false)

  const reset = () => {
    setSponsorName('')
    setType('TITLE')
    setTotalFee('')
    setContractStart('')
    setContractEnd('')
    setPaymentSchedule('ANNUAL')
    setIsOverseas(false)
    setBusinessRegNumber('')
    setPostalCode('')
    setAddress('')
    setAddressDetail('')
    setDomesticBankName('')
    setDomesticAccountNumber('')
    setDomesticAccountHolder('')
    setTaxId('')
    setOverseasAddress('')
    setUkBankName('')
    setUkSortCode('')
    setUkAccountNumber('')
    setUkSwiftBic('')
    setShowPostcode(false)
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
        isOverseas,
        ...(!isOverseas && businessRegNumber && { businessRegNumber }),
        ...(!isOverseas && postalCode && { postalCode }),
        ...(!isOverseas && address && { address }),
        ...(!isOverseas && addressDetail && { addressDetail }),
        ...(!isOverseas && domesticBankName && { domesticBankName }),
        ...(!isOverseas && domesticAccountNumber && { domesticAccountNumber }),
        ...(!isOverseas && domesticAccountHolder && { domesticAccountHolder }),
        ...(isOverseas && taxId && { taxId }),
        ...(isOverseas && overseasAddress && { overseasAddress }),
        ...(isOverseas && ukBankName && { ukBankName }),
        ...(isOverseas && ukSortCode && { ukSortCode }),
        ...(isOverseas && ukAccountNumber && { ukAccountNumber }),
        ...(isOverseas && ukSwiftBic && { ukSwiftBic }),
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
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('form.title')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* 국내/해외 구분 */}
          <div className="space-y-1.5">
            <Label>{t('form.origin')}</Label>
            <RadioGroup
              value={isOverseas ? 'overseas' : 'domestic'}
              onValueChange={(v) => setIsOverseas(v === 'overseas')}
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

          {/* 공통 필드 */}
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
              type="text"
              inputMode="numeric"
              placeholder="0"
              value={totalFee ? Number(totalFee).toLocaleString('ko-KR') : ''}
              onChange={(e) => setTotalFee(e.target.value.replace(/[^0-9]/g, ''))}
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

          {/* 국내 전용 필드 */}
          {!isOverseas && (
            <>
              <div className="space-y-1.5">
                <Label>{t('form.businessRegNumber')}</Label>
                <Input
                  placeholder="000-00-00000"
                  value={businessRegNumber}
                  onChange={(e) => setBusinessRegNumber(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t('form.address')}</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    placeholder={t('form.postalCode')}
                    value={postalCode}
                    className="w-28"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowPostcode(true)}
                  >
                    {t('form.addressSearch')}
                  </Button>
                </div>
                <Input readOnly placeholder={t('form.address')} value={address} />
                <Input
                  placeholder={t('form.addressDetail')}
                  value={addressDetail}
                  onChange={(e) => setAddressDetail(e.target.value)}
                />
              </div>
              <div className="pt-1">
                <p className="text-xs font-medium text-muted-foreground mb-2">{t('form.bankSection.domestic')}</p>
                <div className="space-y-2">
                  <Input placeholder={t('form.bank.bankName')} value={domesticBankName} onChange={(e) => setDomesticBankName(e.target.value)} />
                  <Input placeholder={t('form.bank.accountNumber')} value={domesticAccountNumber} onChange={(e) => setDomesticAccountNumber(e.target.value)} />
                  <Input placeholder={t('form.bank.accountHolder')} value={domesticAccountHolder} onChange={(e) => setDomesticAccountHolder(e.target.value)} />
                </div>
              </div>
            </>
          )}

          {/* 해외 전용 필드 */}
          {isOverseas && (
            <>
              <div className="space-y-1.5">
                <Label>{t('form.taxId')}</Label>
                <Input
                  placeholder="GB123456789"
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t('form.overseasAddress')}</Label>
                <Textarea
                  placeholder="10 Downing Street, London, UK"
                  value={overseasAddress}
                  onChange={(e) => setOverseasAddress(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="pt-1">
                <p className="text-xs font-medium text-muted-foreground mb-2">{t('form.bankSection.uk')}</p>
                <div className="space-y-2">
                  <Input placeholder={t('form.bank.bankName')} value={ukBankName} onChange={(e) => setUkBankName(e.target.value)} />
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder={t('form.bank.sortCode')} value={ukSortCode} onChange={(e) => setUkSortCode(e.target.value)} />
                    <Input placeholder={t('form.bank.accountNumber')} value={ukAccountNumber} onChange={(e) => setUkAccountNumber(e.target.value)} />
                  </div>
                  <Input placeholder={t('form.bank.swiftBic')} value={ukSwiftBic} onChange={(e) => setUkSwiftBic(e.target.value)} />
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

// ── ROI Summary Bar ───────────────────────────────────────────────────────────
function RoiSummaryBar({ roi }: { roi: SponsorshipRoiSummary }) {
  const positive = roi.overallRoi >= 0
  return (
    <div className="px-6 py-3 border-b bg-muted/30 shrink-0">
      <div className="flex items-center gap-6 text-sm flex-wrap">
        <div>
          <span className="text-muted-foreground mr-1.5">계약 총액</span>
          <span className="font-medium tabular-nums">{roi.totalFee.toLocaleString('ko-KR')}원</span>
        </div>
        <div>
          <span className="text-muted-foreground mr-1.5">수납 완료</span>
          <span className="font-medium tabular-nums text-green-600">{roi.totalPaid.toLocaleString('ko-KR')}원</span>
        </div>
        {roi.totalMediaValue > 0 && (
          <div>
            <span className="text-muted-foreground mr-1.5">미디어 가치</span>
            <span className="font-medium tabular-nums">{roi.totalMediaValue.toLocaleString('ko-KR')}원</span>
          </div>
        )}
        {roi.totalMediaValue > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground mr-0.5">ROI</span>
            {positive
              ? <TrendingUp className="h-3.5 w-3.5 text-green-600" />
              : <TrendingDown className="h-3.5 w-3.5 text-red-500" />}
            <span className={`font-semibold tabular-nums ${positive ? 'text-green-600' : 'text-red-500'}`}>
              {positive ? '+' : ''}{roi.overallRoi}%
            </span>
          </div>
        )}
        {roi.totalFanReach > 0 && (
          <div>
            <span className="text-muted-foreground mr-1.5">팬 도달</span>
            <span className="font-medium tabular-nums">{roi.totalFanReach.toLocaleString('ko-KR')}</span>
          </div>
        )}
        {roi.sponsorships.some((s) => s.expiresSoon) && (
          <div className="ml-auto">
            <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 text-xs font-medium px-2 py-0.5 border border-amber-200">
              만료 임박 {roi.sponsorships.filter((s) => s.expiresSoon).length}건
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export function SponsorshipPage() {
  const { t } = useTranslation('sponsorship')
  const navigate = useNavigate()
  const { user } = useCurrentUser()
  const canWrite =
    user?.role === 'ADMIN' ||
    (user?.role === 'FRONT_OFFICE' &&
      (user.frontOfficeRole === 'FINANCE_MANAGER' ||
        user.frontOfficeRole === 'FINANCE_STAFF' ||
        user.frontOfficeRole === 'GM'))

  const [sponsorships, setSponsorships] = useState<Sponsorship[]>([])
  const [roiSummary, setRoiSummary] = useState<SponsorshipRoiSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState<SponsorType | ''>('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [showCreate, setShowCreate] = useState(false)

  const fetchSponsorships = useCallback(() => {
    setLoading(true)
    Promise.all([
      sponsorshipApi.list({ type: typeFilter || undefined, page }),
      sponsorshipApi.getRoiSummary(),
    ])
      .then(([listRes, roiRes]) => {
        setSponsorships(listRes.data)
        setTotalPages(listRes.totalPages)
        setRoiSummary(roiRes)
      })
      .catch(() => toast.error(t('loadFailed')))
      .finally(() => setLoading(false))
  }, [t, typeFilter, page])

  useEffect(() => { fetchSponsorships() }, [fetchSponsorships])

  const handleTypeFilter = (v: string) => {
    setTypeFilter(v as SponsorType | '')
    setPage(1)
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

      {roiSummary && <RoiSummaryBar roi={roiSummary} />}

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
                <TableRow
                  key={sp.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/sponsorship/${sp.id}`)}
                >
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
        onSaved={fetchSponsorships}
      />
    </div>
  )
}
