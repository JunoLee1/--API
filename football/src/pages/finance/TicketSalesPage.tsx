import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { salesApi } from '@/services/sales.service'
import { seasonApi } from '@/services/season.service'
import type { TicketMatchSummary, SalesRecord } from '@/types/sales'
import type { Season } from '@/types/season'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'

export function TicketSalesPage() {
  const [seasons, setSeasons] = useState<Season[]>([])
  const [selectedSeasonId, setSelectedSeasonId] = useState<number | null>(null)
  const [summary, setSummary] = useState<TicketMatchSummary[]>([])
  const [records, setRecords] = useState<SalesRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    seasonApi.list().then((list) => {
      setSeasons(list)
      const active = list.find((s) => s.status === 'ACTIVE') ?? list[0]
      if (active) setSelectedSeasonId(active.id)
    }).catch(() => toast.error('시즌 정보를 불러오지 못했습니다.'))
  }, [])

  useEffect(() => {
    if (!selectedSeasonId) return
    setLoading(true)
    Promise.all([
      salesApi.ticketSummary(selectedSeasonId),
      salesApi.list(),
    ]).then(([s, r]) => {
      setSummary(s)
      setRecords(r.filter((rec) => rec.type === 'TICKET'))
    }).catch(() => toast.error('데이터 로드에 실패했습니다.'))
      .finally(() => setLoading(false))
  }, [selectedSeasonId])

  const totalRevenue = summary.reduce((s, m) => s + m.totalAmount, 0)
  const totalQuantity = summary.reduce((s, m) => s + m.totalQuantity, 0)

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">티켓 판매 기록</h1>
          <p className="text-sm text-muted-foreground mt-0.5">홈경기별 티켓 판매 실적을 조회합니다.</p>
        </div>
        <Select
          value={selectedSeasonId?.toString() ?? ''}
          onValueChange={(v) => setSelectedSeasonId(Number(v))}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="시즌 선택" />
          </SelectTrigger>
          <SelectContent>
            {seasons.map((s) => (
              <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 gap-4">
        {loading ? (
          <>
            <Skeleton className="h-20 rounded-lg" />
            <Skeleton className="h-20 rounded-lg" />
          </>
        ) : (
          <>
            <div className="border rounded-lg p-4">
              <p className="text-sm text-muted-foreground">시즌 티켓 수입</p>
              <p className="text-2xl font-bold mt-1">₩{totalRevenue.toLocaleString()}</p>
            </div>
            <div className="border rounded-lg p-4">
              <p className="text-sm text-muted-foreground">시즌 총 판매량</p>
              <p className="text-2xl font-bold mt-1">{totalQuantity.toLocaleString()}장</p>
            </div>
          </>
        )}
      </div>

      {/* 경기별 요약 */}
      <div className="space-y-2">
        <h2 className="text-base font-semibold">경기별 요약</h2>
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>경기일</TableHead>
                <TableHead>홈</TableHead>
                <TableHead>어웨이</TableHead>
                <TableHead className="text-right">판매량</TableHead>
                <TableHead className="text-right">수입</TableHead>
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
              {!loading && summary.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    티켓 판매 기록이 없습니다.
                  </TableCell>
                </TableRow>
              )}
              {summary.map((m) => (
                <TableRow key={m.matchId}>
                  <TableCell>
                    {new Date(m.date).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </TableCell>
                  <TableCell className="font-medium">{m.homeTeamName}</TableCell>
                  <TableCell>{m.awayTeamName}</TableCell>
                  <TableCell className="text-right">{m.totalQuantity.toLocaleString()}장</TableCell>
                  <TableCell className="text-right font-semibold">₩{m.totalAmount.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* 전체 판매 기록 */}
      <div className="space-y-2">
        <h2 className="text-base font-semibold">전체 판매 기록</h2>
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>날짜</TableHead>
                <TableHead>경기</TableHead>
                <TableHead className="text-right">수량</TableHead>
                <TableHead className="text-right">단가</TableHead>
                <TableHead className="text-right">합계</TableHead>
                <TableHead>메모</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    판매 기록이 없습니다.
                  </TableCell>
                </TableRow>
              )}
              {records.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    {new Date(r.saleDate).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </TableCell>
                  <TableCell>
                    {r.match
                      ? `${r.match.homeTeamName} vs ${r.match.awayTeamName}`
                      : <span className="text-muted-foreground text-xs">미연결</span>}
                  </TableCell>
                  <TableCell className="text-right">{r.quantity.toLocaleString()}</TableCell>
                  <TableCell className="text-right">₩{Number(r.unitPrice).toLocaleString()}</TableCell>
                  <TableCell className="text-right font-medium">₩{Number(r.totalAmount).toLocaleString()}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{r.description ?? '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
