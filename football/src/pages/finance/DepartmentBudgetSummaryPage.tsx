import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { departmentPlanApi, type BudgetSummaryItem } from '@/services/department-plan.service'
import { seasonApi } from '@/services/season.service'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { canReadFinance } from '@/lib/permissions'
import type { Season } from '@/types/season'
import {
  OPERATING_CATEGORIES,
  OPERATING_CATEGORY_LABEL,
  type OperatingCategory,
} from '@/types/department-plan'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'

export function DepartmentBudgetSummaryPage() {
  const { user } = useCurrentUser()
  const hasAccess = !!user && canReadFinance(user.role, user.frontOfficeRole)

  const [seasons, setSeasons] = useState<Season[]>([])
  const [selectedSeasonId, setSelectedSeasonId] = useState<number | null>(null)
  const [summary, setSummary] = useState<BudgetSummaryItem[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    seasonApi.list().then((s) => {
      setSeasons(s)
      const active = s.find((x) => x.status === 'ACTIVE') ?? s[0]
      if (active) setSelectedSeasonId(active.id)
    }).catch(() => toast.error('시즌 정보를 불러오지 못했습니다.'))
  }, [])

  useEffect(() => {
    if (!selectedSeasonId) return
    setLoading(true)
    departmentPlanApi.budgetSummary(selectedSeasonId)
      .then(setSummary)
      .catch(() => toast.error('예산 요약을 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }, [selectedSeasonId])

  if (!hasAccess) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        접근 권한이 없습니다.
      </div>
    )
  }

  // Build pivot table: rows = departments, cols = categories
  const deptMap: Record<number, { name: string; amounts: Record<string, number> }> = {}
  for (const item of summary) {
    if (!deptMap[item.departmentId]) {
      deptMap[item.departmentId] = { name: item.departmentName, amounts: {} }
    }
    deptMap[item.departmentId].amounts[item.category] = item.total
  }

  const depts = Object.entries(deptMap).map(([idStr, val]) => ({
    id: Number(idStr),
    name: val.name,
    amounts: val.amounts,
    rowTotal: OPERATING_CATEGORIES.reduce((s, c) => s + (val.amounts[c] ?? 0), 0),
  }))

  // Category column totals
  const catTotals: Record<string, number> = {}
  for (const cat of OPERATING_CATEGORIES) {
    catTotals[cat] = depts.reduce((s, d) => s + (d.amounts[cat] ?? 0), 0)
  }
  const grandTotal = depts.reduce((s, d) => s + d.rowTotal, 0)

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">부서 예산 요약</h1>
          <p className="text-sm text-muted-foreground mt-0.5">승인된 계획서 기준 부서별 카테고리별 예산 합계입니다.</p>
        </div>
        <Select
          value={selectedSeasonId?.toString() ?? ''}
          onValueChange={(v) => setSelectedSeasonId(Number(v))}
        >
          <SelectTrigger className="w-36">
            <span className={selectedSeasonId ? '' : 'text-muted-foreground'}>
              {seasons.find((s) => s.id === selectedSeasonId)?.name ?? '시즌 선택'}
            </span>
          </SelectTrigger>
          <SelectContent>
            {seasons.map((s) => (
              <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : depts.length === 0 ? (
        <div className="border rounded-lg p-10 text-center text-muted-foreground">
          승인된 계획서가 없습니다.
        </div>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-32">부서</TableHead>
                {OPERATING_CATEGORIES.map((cat) => (
                  <TableHead key={cat} className="text-right min-w-28">
                    {OPERATING_CATEGORY_LABEL[cat as OperatingCategory]}
                  </TableHead>
                ))}
                <TableHead className="text-right min-w-28 font-bold">합계</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {depts.map((dept) => (
                <TableRow key={dept.id}>
                  <TableCell className="font-medium">{dept.name}</TableCell>
                  {OPERATING_CATEGORIES.map((cat) => (
                    <TableCell key={cat} className="text-right text-sm">
                      {dept.amounts[cat]
                        ? `₩${dept.amounts[cat].toLocaleString()}`
                        : <span className="text-muted-foreground">-</span>}
                    </TableCell>
                  ))}
                  <TableCell className="text-right font-semibold">
                    ₩{dept.rowTotal.toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
              {/* 합계 행 */}
              <TableRow className="bg-muted/50 font-semibold">
                <TableCell>전체 합계</TableCell>
                {OPERATING_CATEGORIES.map((cat) => (
                  <TableCell key={cat} className="text-right">
                    {catTotals[cat] > 0
                      ? `₩${catTotals[cat].toLocaleString()}`
                      : <span className="text-muted-foreground font-normal">-</span>}
                  </TableCell>
                ))}
                <TableCell className="text-right">₩{grandTotal.toLocaleString()}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
