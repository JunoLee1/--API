import { useEffect, useRef, useState } from 'react'
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
import type { AcademyFee, YouthPlayerSearchResult } from '@/types/academy-fee'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Plus } from 'lucide-react'

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  PENDING: 'outline', SUBMITTED: 'secondary', FIRST_APPROVED: 'secondary', PAID: 'default', OVERDUE: 'destructive', LOCKED: 'destructive'
}

const currentYear = new Date().getFullYear()
const currentMonth = new Date().getMonth() + 1

// 회비 등록 다이얼로그: 선수 검색 → 연/월/금액 + 영수증 첨부 → SUBMITTED 생성
function RegisterFeeDialog({ open, onOpenChange, onDone }: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onDone: () => void
}) {
  const [step, setStep] = useState<1 | 2>(1)
  const [searchName, setSearchName] = useState('')
  const [searching, setSearching] = useState(false)
  const [players, setPlayers] = useState<YouthPlayerSearchResult[]>([])
  const [selectedPlayer, setSelectedPlayer] = useState<YouthPlayerSearchResult | null>(null)
  const [year, setYear] = useState(String(currentYear))
  const [month, setMonth] = useState(String(currentMonth))
  const [amount, setAmount] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const reset = () => {
    setStep(1); setSearchName(''); setPlayers([]); setSelectedPlayer(null)
    setYear(String(currentYear)); setMonth(String(currentMonth))
    setAmount(''); setFile(null)
  }

  const handleSearch = async () => {
    if (!searchName.trim()) return
    setSearching(true)
    try {
      setPlayers(await academyFeeApi.searchPlayers(searchName))
    } catch { toast.error('검색에 실패했습니다.') }
    finally { setSearching(false) }
  }

  const handleSubmit = async () => {
    if (!selectedPlayer || !year || !month || !amount || !file) {
      toast.error('모든 항목을 입력하고 영수증 파일을 선택하세요.')
      return
    }
    setSubmitting(true)
    try {
      await academyFeeApi.registerWithProof(
        selectedPlayer.id,
        Number(year),
        Number(month),
        Number(amount.replace(/,/g, '')),
        file,
      )
      toast.success('회비가 등록됐습니다.')
      onDone(); onOpenChange(false); reset()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '등록에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) reset(); onOpenChange(v) }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>회비 등록</DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">선수 이름으로 검색하세요.</p>
            <div className="flex gap-2">
              <Input
                placeholder="선수 이름"
                value={searchName}
                onChange={e => setSearchName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && void handleSearch()}
              />
              <Button onClick={() => void handleSearch()} disabled={searching}>검색</Button>
            </div>
            {players.length > 0 && (
              <div className="border rounded-md divide-y max-h-48 overflow-y-auto">
                {players.map(p => (
                  <button
                    key={p.id}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                    onClick={() => { setSelectedPlayer(p); setStep(2) }}
                  >
                    {p.playerName}
                  </button>
                ))}
              </div>
            )}
            {players.length === 0 && searchName && !searching && (
              <p className="text-sm text-muted-foreground">검색 결과가 없습니다.</p>
            )}
          </div>
        )}

        {step === 2 && selectedPlayer && (
          <div className="space-y-3 py-2">
            <p className="text-sm font-medium">{selectedPlayer.playerName} 선수</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>연도</Label>
                <Input type="number" value={year} onChange={e => setYear(e.target.value)} min={2020} max={2100} />
              </div>
              <div className="space-y-1.5">
                <Label>월</Label>
                <Input type="number" value={month} onChange={e => setMonth(e.target.value)} min={1} max={12} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>금액 (원)</Label>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="예: 150,000"
                value={amount ? Number(amount.replace(/,/g, '')).toLocaleString('ko-KR') : ''}
                onChange={e => setAmount(e.target.value.replace(/[^0-9]/g, ''))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>영수증</Label>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                  파일 선택
                </Button>
                <span className="text-sm text-muted-foreground truncate">
                  {file ? file.name : '선택된 파일 없음'}
                </span>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) setFile(f); e.target.value = '' }}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          {step === 1 && (
            <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          )}
          {step === 2 && (
            <>
              <Button variant="outline" onClick={() => setStep(1)} disabled={submitting}>← 뒤로</Button>
              <Button onClick={() => void handleSubmit()} disabled={submitting || !file || !amount}>
                {submitting ? '등록 중...' : '등록'}
              </Button>
            </>
          )}
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
  const [registerFeeOpen, setRegisterFeeOpen] = useState(false)

  const canFinanceUpload =
    user?.role === 'ADMIN' ||
    user?.role === 'SUPER_ADMIN' ||
    user?.role === 'GM' ||
    (user?.role === 'FRONT_OFFICE' &&
      (user.frontOfficeRole === 'FINANCE_STAFF' ||
        user.frontOfficeRole === 'FINANCE_MANAGER' ||
        user.frontOfficeRole === 'TD'))

  const canFirstApprove =
    user?.role === 'ADMIN' ||
    user?.role === 'SUPER_ADMIN' ||
    user?.role === 'GM' ||
    (user?.role === 'FRONT_OFFICE' && user.frontOfficeRole === 'FINANCE_MANAGER')

  const canSecondApprove =
    user?.role === 'ADMIN' ||
    user?.role === 'SUPER_ADMIN' ||
    user?.role === 'GM'

  const load = () => {
    setLoading(true)
    academyFeeApi.getAll(filter ? { status: filter } : {}).then(setFees).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [filter])

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t('feePage.title')}</h1>
        <div className="flex items-center gap-2">
          <div className="flex gap-2">
            {['', 'PENDING', 'SUBMITTED', 'FIRST_APPROVED', 'OVERDUE', 'LOCKED'].map(s => (
              <Button key={s} size="sm" variant={filter === s ? 'default' : 'outline'} onClick={() => setFilter(s)}>
                {s ? t(`feePage.status.${s}`) : t('feePage.filterAll')}
              </Button>
            ))}
          </div>
          {canFinanceUpload && (
            <Button size="sm" onClick={() => setRegisterFeeOpen(true)}>
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
                  <span className="text-xs text-muted-foreground ml-2">
                    {fee.paymentMethod === 'PG' ? '카드/간편결제' : '계좌이체'}
                  </span>
                )}
              </div>
              <Badge variant={STATUS_VARIANT[fee.status]}>{t(`feePage.status.${fee.status}`)}</Badge>
              {canFirstApprove && !canSecondApprove && fee.status === 'SUBMITTED' && (
                <Button size="sm" variant="outline" onClick={async () => { await academyFeeApi.firstApprove(fee.id); load() }}>
                  1차 승인
                </Button>
              )}
              {canSecondApprove && (fee.status === 'SUBMITTED' || fee.status === 'FIRST_APPROVED') && (
                <Button size="sm" onClick={async () => { await academyFeeApi.approve(fee.id); load() }}>
                  최종 승인
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

      <RegisterFeeDialog
        open={registerFeeOpen}
        onOpenChange={setRegisterFeeOpen}
        onDone={load}
      />
    </div>
  )
}
