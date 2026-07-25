import type { AcademyFinanceStats } from '@/types/academy-fee'

interface Props { data: AcademyFinanceStats }

export function AcademyFinanceSection({ data }: Props) {
  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">아카데미 회비 현황</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{data.monthlyCollectionRate}%</p>
          <p className="text-xs text-muted-foreground mt-1">당월 수납률</p>
        </div>
        <div className="rounded-lg border p-4 text-center">
          <p className="text-2xl font-bold">{data.totalRevenue.toLocaleString()}원</p>
          <p className="text-xs text-muted-foreground mt-1">총 수납액</p>
        </div>
        <div className="rounded-lg border p-4 text-center">
          <p className={`text-2xl font-bold ${data.overdueCount > 0 ? 'text-yellow-600' : ''}`}>{data.overdueCount}건</p>
          <p className="text-xs text-muted-foreground mt-1">미납/연체</p>
        </div>
        <div className="rounded-lg border p-4 text-center">
          <p className={`text-2xl font-bold ${data.lockedPlayerCount > 0 ? 'text-red-600' : ''}`}>{data.lockedPlayerCount}명</p>
          <p className="text-xs text-muted-foreground mt-1">참가 정지</p>
        </div>
      </div>
    </div>
  )
}
