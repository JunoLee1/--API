import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { departmentPlanApi } from '@/services/department-plan.service'
import { seasonApi } from '@/services/season.service'
import { departmentApi } from '@/services/department.service'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import type { DepartmentAnnualPlan, PlanStatus } from '@/types/department-plan'
import type { Season } from '@/types/season'
import type { Department } from '@/services/department.service'
import { PLAN_STATUS_LABEL, PLAN_STATUS_CLASS } from '@/types/department-plan'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

const ALL = '__ALL__'

export function DepartmentPlanListPage() {
  const navigate = useNavigate()
  const { user } = useCurrentUser()

  const canWrite = !!user

  const [seasons, setSeasons] = useState<Season[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [plans, setPlans] = useState<DepartmentAnnualPlan[]>([])
  const [loading, setLoading] = useState(false)

  const [selectedSeasonId, setSelectedSeasonId] = useState<number | null>(null)
  const [filterDeptId, setFilterDeptId] = useState<string>(ALL)
  const [filterStatus, setFilterStatus] = useState<string>(ALL)

  useEffect(() => {
    Promise.all([seasonApi.list(), departmentApi.list()]).then(([s, d]) => {
      setSeasons(s)
      setDepartments(d.filter((dept) => dept.isActive))
      const active = s.find((x) => x.status === 'ACTIVE') ?? s[0]
      if (active) setSelectedSeasonId(active.id)
    }).catch(() => toast.error('초기 데이터를 불러오지 못했습니다.'))
  }, [])

  useEffect(() => {
    if (!selectedSeasonId) return
    setLoading(true)
    departmentPlanApi.list({
      seasonId: selectedSeasonId,
      ...(filterDeptId !== ALL && { departmentId: Number(filterDeptId) }),
      ...(filterStatus !== ALL && { status: filterStatus }),
    }).then(setPlans)
      .catch(() => toast.error('계획서 목록 로드 실패'))
      .finally(() => setLoading(false))
  }, [selectedSeasonId, filterDeptId, filterStatus])

  const totalBudget = (plan: DepartmentAnnualPlan) =>
    plan.budgetItems.reduce((s, b) => s + b.amount, 0)

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">부서 연간 계획서</h1>
          <p className="text-sm text-muted-foreground mt-0.5">부서별 시즌 목표·예산·KPI 계획을 관리합니다.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
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
          {canWrite && (
            <Button onClick={() => navigate('/finance/department-plans/new')}>새 계획서 작성</Button>
          )}
        </div>
      </div>

      {/* 필터 */}
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={filterDeptId} onValueChange={setFilterDeptId}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="부서 전체" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>부서 전체</SelectItem>
            {departments.map((d) => (
              <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="상태 전체" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>상태 전체</SelectItem>
            {(Object.keys(PLAN_STATUS_LABEL) as PlanStatus[]).map((s) => (
              <SelectItem key={s} value={s}>{PLAN_STATUS_LABEL[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(filterDeptId !== ALL || filterStatus !== ALL) && (
          <Button size="sm" variant="ghost" onClick={() => { setFilterDeptId(ALL); setFilterStatus(ALL) }}>
            초기화
          </Button>
        )}
      </div>

      {/* 테이블 */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>부서명</TableHead>
              <TableHead>상태</TableHead>
              <TableHead className="text-right">예산 합계</TableHead>
              <TableHead>작성자</TableHead>
              <TableHead>생성일</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={5} className="py-8">
                  <div className="space-y-2 px-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-6 w-full" />
                    ))}
                  </div>
                </TableCell>
              </TableRow>
            )}
            {!loading && plans.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                  계획서가 없습니다.
                </TableCell>
              </TableRow>
            )}
            {!loading && plans.map((plan) => (
              <TableRow
                key={plan.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => navigate(`/finance/department-plans/${plan.id}`)}
              >
                <TableCell className="font-medium">{plan.department.name}</TableCell>
                <TableCell>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${PLAN_STATUS_CLASS[plan.status]}`}>
                    {PLAN_STATUS_LABEL[plan.status]}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  {totalBudget(plan) > 0
                    ? `₩${totalBudget(plan).toLocaleString()}`
                    : <span className="text-muted-foreground">-</span>}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{plan.createdBy.username}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(plan.createdAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
