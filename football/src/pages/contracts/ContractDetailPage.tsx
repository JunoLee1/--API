import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { contractApi } from '@/services/contract.service'
import type {
  ContractDetail, BonusMetric, BonusPeriod, CompetitionType,
  CreateExtensionDto, CreateBonusDto,
} from '@/types/contract'
import {
  CONTRACT_STATUS_LABEL, CONTRACT_STATUS_STYLE,
  BONUS_METRIC_LABEL, BONUS_PERIOD_LABEL, formatSalary,
} from '@/types/contract'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ArrowLeft, Plus } from 'lucide-react'

const BONUS_METRICS = Object.keys(BONUS_METRIC_LABEL) as BonusMetric[]
const BONUS_PERIODS = Object.keys(BONUS_PERIOD_LABEL) as BonusPeriod[]
const COMPETITION_TYPES: Array<{ value: CompetitionType | ''; label: string }> = [
  { value: '', label: '전체' },
  { value: 'LEAGUE', label: '리그' },
  { value: 'CUP', label: '컵' },
  { value: 'CHAMPIONS_LEAGUE', label: '챔피언스리그' },
  { value: 'FRIENDLY', label: '친선경기' },
]

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ko-KR')
}

interface AddExtensionDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  contractId: number
  onSaved: () => void
}

function AddExtensionDialog({ open, onOpenChange, contractId, onSaved }: AddExtensionDialogProps) {
  const [condition, setCondition] = useState('')
  const [durationMonths, setDurationMonths] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!condition.trim() || !durationMonths) {
      toast.error('모든 항목을 입력해주세요.')
      return
    }
    setSaving(true)
    try {
      const dto: CreateExtensionDto = {
        condition: condition.trim(),
        durationMonths: Number(durationMonths),
      }
      await contractApi.addExtension(contractId, dto)
      toast.success('연장 옵션이 추가됐습니다.')
      setCondition(''); setDurationMonths('')
      onSaved()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>연장 옵션 추가</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>조건 *</Label>
            <Input
              placeholder="챔피언스리그 진출 시 1년 연장"
              value={condition}
              onChange={e => setCondition(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>연장 기간(개월) *</Label>
            <Input
              type="number" min="1" placeholder="12"
              value={durationMonths}
              onChange={e => setDurationMonths(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>취소</Button>
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? '저장 중...' : '추가'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface AddBonusDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  contractId: number
  onSaved: () => void
}

function AddBonusDialog({ open, onOpenChange, contractId, onSaved }: AddBonusDialogProps) {
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [metric, setMetric] = useState<BonusMetric>('GOALS')
  const [threshold, setThreshold] = useState('')
  const [period, setPeriod] = useState<BonusPeriod>('SEASON')
  const [competitionType, setCompetitionType] = useState<CompetitionType | ''>('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!description.trim() || !amount || !threshold) {
      toast.error('필수 항목을 모두 입력해주세요.')
      return
    }
    setSaving(true)
    try {
      const dto: CreateBonusDto = {
        amount: Number(amount),
        description: description.trim(),
        triggers: [{
          metric,
          threshold: Number(threshold),
          period,
          competitionType: competitionType || null,
        }],
      }
      await contractApi.addBonus(contractId, dto)
      toast.success('성과 보너스가 추가됐습니다.')
      setDescription(''); setAmount(''); setThreshold('')
      onSaved()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>성과 보너스 추가</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>설명 *</Label>
            <Input
              placeholder="시즌 10골 달성 보너스"
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>금액(원) *</Label>
            <Input
              type="number" placeholder="5000000"
              value={amount}
              onChange={e => setAmount(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>지표 *</Label>
            <Select value={metric} onValueChange={v => setMetric(v as BonusMetric)} items={BONUS_METRIC_LABEL}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {BONUS_METRICS.map(m => (
                  <SelectItem key={m} value={m}>{BONUS_METRIC_LABEL[m]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>임계값 *</Label>
            <Input
              type="number" placeholder="10"
              value={threshold}
              onChange={e => setThreshold(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>기간 *</Label>
            <Select value={period} onValueChange={v => setPeriod(v as BonusPeriod)} items={BONUS_PERIOD_LABEL}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {BONUS_PERIODS.map(p => (
                  <SelectItem key={p} value={p}>{BONUS_PERIOD_LABEL[p]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>대회 유형</Label>
            <Select
              value={competitionType}
              onValueChange={v => setCompetitionType(v as CompetitionType | '')}
              items={Object.fromEntries(COMPETITION_TYPES.map(c => [c.value, c.label]))}
            >
              <SelectTrigger><SelectValue placeholder="전체" /></SelectTrigger>
              <SelectContent>
                {COMPETITION_TYPES.map(c => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>취소</Button>
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? '저장 중...' : '추가'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ContractDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useCurrentUser()
  const [contract, setContract] = useState<ContractDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [buyoutAmount, setBuyoutAmount] = useState('')
  const [addingBuyout, setAddingBuyout] = useState(false)
  const [extensionDialogOpen, setExtensionDialogOpen] = useState(false)
  const [bonusDialogOpen, setBonusDialogOpen] = useState(false)

  const canWrite = user?.role === 'ADMIN' || user?.role === 'FRONT_OFFICE'

  const load = async () => {
    if (!id) return
    setLoading(true)
    try {
      const data = await contractApi.get(Number(id))
      setContract(data)
    } catch {
      toast.error('계약 정보를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [id])

  const handleAddBuyout = async () => {
    if (!buyoutAmount || !contract) return
    setAddingBuyout(true)
    try {
      await contractApi.addBuyout(contract.id, Number(buyoutAmount))
      toast.success('바이아웃 조항이 추가됐습니다.')
      setBuyoutAmount('')
      void load()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '저장에 실패했습니다.')
    } finally {
      setAddingBuyout(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
      </div>
    )
  }

  if (!contract) return null

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 flex items-center gap-3 shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-lg font-semibold tracking-tight">계약 상세</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs ${CONTRACT_STATUS_STYLE[contract.status]}`}>
              {CONTRACT_STATUS_LABEL[contract.status]}
            </span>
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-8">
        {/* 기본 정보 */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground mb-3">기본 정보</h2>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground">계약 기간</dt>
              <dd className="font-medium tabular-nums">
                {formatDate(contract.startDate)} — {formatDate(contract.endDate)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">연봉</dt>
              <dd className="font-medium">{formatSalary(contract.salary)}</dd>
            </div>
          </dl>
        </section>

        {/* 바이아웃 조항 */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground mb-3">바이아웃 조항</h2>
          {contract.buyoutClause ? (
            <p className="text-sm font-medium">{formatSalary(contract.buyoutClause.amount)}</p>
          ) : canWrite ? (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                placeholder="금액(원)"
                value={buyoutAmount}
                onChange={e => setBuyoutAmount(e.target.value)}
                className="w-40 h-8 text-sm"
              />
              <Button
                size="sm" className="h-8"
                onClick={() => void handleAddBuyout()}
                disabled={addingBuyout || !buyoutAmount}
              >
                {addingBuyout ? '저장 중...' : '추가'}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">없음</p>
          )}
        </section>

        {/* 연장 옵션 */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-muted-foreground">연장 옵션</h2>
            {canWrite && (
              <Button
                size="sm" variant="outline" className="h-7 text-xs"
                onClick={() => setExtensionDialogOpen(true)}
              >
                <Plus className="h-3 w-3 mr-1" />추가
              </Button>
            )}
          </div>
          {contract.extensionOptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">등록된 연장 옵션이 없습니다.</p>
          ) : (
            <ul className="space-y-2">
              {contract.extensionOptions.map(e => (
                <li key={e.id} className="rounded border px-3 py-2 text-sm">
                  <span className="font-medium">{e.durationMonths}개월</span>
                  <span className="mx-2 text-muted-foreground">—</span>
                  {e.condition}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 성과 보너스 */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-muted-foreground">성과 보너스</h2>
            {canWrite && (
              <Button
                size="sm" variant="outline" className="h-7 text-xs"
                onClick={() => setBonusDialogOpen(true)}
              >
                <Plus className="h-3 w-3 mr-1" />추가
              </Button>
            )}
          </div>
          {contract.performanceBonuses.length === 0 ? (
            <p className="text-sm text-muted-foreground">등록된 성과 보너스가 없습니다.</p>
          ) : (
            <ul className="space-y-3">
              {contract.performanceBonuses.map(b => (
                <li key={b.id} className="rounded border px-3 py-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{b.description}</span>
                    <span className="text-sm tabular-nums">{formatSalary(b.amount)}</span>
                  </div>
                  <ul className="space-y-1">
                    {b.triggers.map(t => (
                      <li key={t.id} className="text-xs text-muted-foreground">
                        {BONUS_METRIC_LABEL[t.metric]} ≥ {t.threshold} ({BONUS_PERIOD_LABEL[t.period]})
                        {t.competitionType && ` · ${t.competitionType}`}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <AddExtensionDialog
        open={extensionDialogOpen}
        onOpenChange={setExtensionDialogOpen}
        contractId={contract.id}
        onSaved={() => { setExtensionDialogOpen(false); void load() }}
      />
      <AddBonusDialog
        open={bonusDialogOpen}
        onOpenChange={setBonusDialogOpen}
        contractId={contract.id}
        onSaved={() => { setBonusDialogOpen(false); void load() }}
      />
    </div>
  )
}
