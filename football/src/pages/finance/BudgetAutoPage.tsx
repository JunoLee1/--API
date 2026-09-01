import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, ArrowLeft, Wand2 } from 'lucide-react'
import { budgetAutomationApi } from '@/services/budgetAutomation.service'
import { seasonApi } from '@/services/season.service'
import type { BudgetPreviewResponse, GoalWeight, OperatingCategory, BudgetPreviewRequest } from '@/types/budget-automation'
import type { Season } from '@/types/season'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useExpenseCategories } from '@/hooks/useExpenseCategories'

const GOAL_LABELS: Record<GoalWeight, string> = {
  AGGRESSIVE: '공격적 투자 (×1.2)',
  MAINTAIN: '현상 유지 (×1.0)',
  CONSERVATIVE: '긴축 재정 (×0.8)',
}

const REVENUE_KEYS = ['plannedRevenueTicket', 'plannedRevenueSponsorship', 'plannedRevenueBroadcast', 'plannedRevenueMerchandise', 'plannedRevenueSubsidy', 'plannedRevenueParentCompany', 'plannedRevenueAcademyFee', 'plannedRevenueOther'] as const

const REVENUE_LABELS: Record<string, string> = {
  plannedRevenueTicket: '티켓 수입',
  plannedRevenueSponsorship: '스폰서십',
  plannedRevenueBroadcast: '중계권',
  plannedRevenueMerchandise: '머천다이즈',
  plannedRevenueSubsidy: '보조금',
  plannedRevenueParentCompany: '모기업 지원',
  plannedRevenueAcademyFee: '아카데미 수강료',
  plannedRevenueOther: '기타',
}

const WARNING_LABEL: Record<string, string> = {
  INSUFFICIENT_DATA: '데이터 부족',
  LOW_UTILIZATION: '낮은 집행률',
  HIGH_VOLATILITY: '높은 변동성',
}

function fmt(n: number) {
  return new Intl.NumberFormat('ko-KR').format(n)
}

function CagrBadge({ cagr }: { cagr: number }) {
  const pct = (cagr * 100).toFixed(1)
  return (
    <span className={`text-xs font-mono ${cagr >= 0 ? 'text-green-600' : 'text-red-500'}`}>
      {cagr >= 0 ? '+' : ''}{pct}%
    </span>
  )
}

export default function BudgetAutoPage() {
  const navigate = useNavigate()
  const { user } = useCurrentUser()
  const canApply = user?.frontOfficeRole === 'FINANCE_MANAGER' || user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN'

  const { rows: expenseCats, labelOf } = useExpenseCategories()

  const [seasons, setSeasons] = useState<Season[]>([])
  const [targetSeasonId, setTargetSeasonId] = useState('')
  const [lookback, setLookback] = useState('3')
  const [inflation, setInflation] = useState('3')
  const [revenueGoal, setRevenueGoal] = useState<GoalWeight>('MAINTAIN')
  const [expenseGoal, setExpenseGoal] = useState<GoalWeight>('MAINTAIN')
  const [categoryOverrides, setCategoryOverrides] = useState<Partial<Record<OperatingCategory, GoalWeight>>>({})
  const [preview, setPreview] = useState<BudgetPreviewResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [applyName, setApplyName] = useState('')
  const [applying, setApplying] = useState(false)

  useEffect(() => {
    seasonApi.list().then(setSeasons).catch(() => null)
  }, [])

  const handlePreview = async () => {
    if (!targetSeasonId) { toast.error('시즌을 선택하세요'); return }
    setLoading(true)
    try {
      const req: BudgetPreviewRequest = {
        targetSeasonId: Number(targetSeasonId),
        lookback: Number(lookback),
        inflation: Number(inflation) / 100,
        revenueGoal,
        expenseGoal,
        categoryOverrides: Object.keys(categoryOverrides).length > 0 ? categoryOverrides : undefined,
      }
      const result = await budgetAutomationApi.preview(req)
      setPreview(result)
      setApplyName(`${seasons.find(s => s.id === Number(targetSeasonId))?.name ?? ''} 자동 산출 예산안`)
    } catch {
      toast.error('예측 계산 중 오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  const handleApply = async () => {
    if (!preview || !applyName.trim()) { toast.error('예산안 이름을 입력하세요'); return }
    setApplying(true)
    try {
      const header = await budgetAutomationApi.apply({
        targetSeasonId: Number(targetSeasonId),
        lookback: Number(lookback),
        inflation: Number(inflation) / 100,
        revenueGoal,
        expenseGoal,
        categoryOverrides: Object.keys(categoryOverrides).length > 0 ? categoryOverrides : undefined,
        name: applyName.trim(),
      })
      toast.success('예산안이 생성되었습니다')
      navigate(`/finance/budget/${header.id}`)
    } catch {
      toast.error('예산안 생성 중 오류가 발생했습니다')
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/finance/budget')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">예산 자동 산출</h1>
      </div>

      <Card>
        <CardHeader><CardTitle>파라미터 설정</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>대상 시즌</Label>
            <Select value={targetSeasonId} onValueChange={setTargetSeasonId}>
              <SelectTrigger><SelectValue placeholder="시즌 선택" /></SelectTrigger>
              <SelectContent>
                {seasons.map(s => <SelectItem key={s.id} value={String(s.id)} label={s.name}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>과거 참조 시즌 수</Label>
            <Select value={lookback} onValueChange={setLookback}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {['2','3','4','5'].map(v => <SelectItem key={v} value={v} label={`${v}시즌`}>{v}시즌</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>물가 상승률 (%)</Label>
            <Input type="number" value={inflation} onChange={e => setInflation(e.target.value)} min={0} max={20} step={0.5} />
          </div>
          <div />
          <div className="space-y-1">
            <Label>수익 목표</Label>
            <Select value={revenueGoal} onValueChange={v => setRevenueGoal(v as GoalWeight)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(GOAL_LABELS) as GoalWeight[]).map(g => (
                  <SelectItem key={g} value={g} label={GOAL_LABELS[g]}>{GOAL_LABELS[g]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>지출 목표</Label>
            <Select value={expenseGoal} onValueChange={v => setExpenseGoal(v as GoalWeight)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(GOAL_LABELS) as GoalWeight[]).map(g => (
                  <SelectItem key={g} value={g} label={GOAL_LABELS[g]}>{GOAL_LABELS[g]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>카테고리별 지출 목표 (선택)</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {expenseCats.map(cat => (
              <div key={cat.code} className="space-y-1">
                <Label>{cat.label}</Label>
                <Select
                  value={categoryOverrides[cat.code] ?? ''}
                  onValueChange={v => {
                    const next = { ...categoryOverrides }
                    if (v) next[cat.code] = v as GoalWeight; else delete next[cat.code]
                    setCategoryOverrides(next)
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="기본값 사용" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="" label="기본값 사용">기본값 사용</SelectItem>
                    {(Object.keys(GOAL_LABELS) as GoalWeight[]).map(g => (
                      <SelectItem key={g} value={g} label={GOAL_LABELS[g]}>{GOAL_LABELS[g]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Button onClick={handlePreview} disabled={loading} className="w-full">
        <Wand2 className="mr-2 h-4 w-4" />
        {loading ? '계산 중...' : '예산 자동 산출'}
      </Button>

      {preview && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>수익 예측 <span className="text-muted-foreground text-sm font-normal">({preview.parameters.seasonsUsed}시즌 기준)</span></CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-1">카테고리</th>
                    <th className="text-right py-1">CAGR</th>
                    <th className="text-right py-1">예측 금액</th>
                    <th className="text-right py-1"></th>
                  </tr>
                </thead>
                <tbody>
                  {REVENUE_KEYS.map(key => {
                    const p = preview.revenue.byCategory[key]
                    return (
                      <tr key={key} className="border-b last:border-0">
                        <td className="py-1.5">{REVENUE_LABELS[key]}</td>
                        <td className="text-right"><CagrBadge cagr={p.cagr} /></td>
                        <td className="text-right font-mono">₩{fmt(p.predicted)}</td>
                        <td className="text-right">
                          {p.warning && (
                            <Badge variant="outline" className="text-amber-600 border-amber-400 text-xs gap-1">
                              <AlertTriangle className="h-3 w-3" />{WARNING_LABEL[p.warning]}
                            </Badge>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  <tr className="font-semibold">
                    <td className="pt-2">합계</td>
                    <td />
                    <td className="text-right pt-2 font-mono">₩{fmt(preview.revenue.total)}</td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>지출 예측</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-1">카테고리</th>
                    <th className="text-right py-1">CAGR</th>
                    <th className="text-right py-1">예측 금액</th>
                    <th className="text-right py-1"></th>
                  </tr>
                </thead>
                <tbody>
                  {expenseCats.map(cat => {
                    const p = preview.expense.byCategory[cat.code]
                    if (!p) return null
                    return (
                      <tr key={cat.code} className="border-b last:border-0">
                        <td className="py-1.5">{cat.label}</td>
                        <td className="text-right"><CagrBadge cagr={p.cagr} /></td>
                        <td className="text-right font-mono">₩{fmt(p.predicted)}</td>
                        <td className="text-right">
                          {p.warning && (
                            <Badge variant="outline" className="text-amber-600 border-amber-400 text-xs gap-1">
                              <AlertTriangle className="h-3 w-3" />{WARNING_LABEL[p.warning]}
                            </Badge>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  <tr className="font-semibold">
                    <td className="pt-2">합계</td>
                    <td />
                    <td className="text-right pt-2 font-mono">₩{fmt(preview.expense.total)}</td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>

          {canApply && (
            <Card>
              <CardHeader><CardTitle>예산안 확정</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label>예산안 이름</Label>
                  <Input value={applyName} onChange={e => setApplyName(e.target.value)} placeholder="예) 2026/27 시즌 예산안" />
                </div>
                <Button onClick={handleApply} disabled={applying} className="w-full">
                  {applying ? '생성 중...' : '이 안으로 예산안 생성 (DRAFT)'}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
