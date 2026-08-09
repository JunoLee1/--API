import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { salesApi } from '@/services/sales.service'
import { seasonApi } from '@/services/season.service'
import { matchApi } from '@/services/match.service'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import type { TicketMatchSummary, SalesRecord } from '@/types/sales'
import type { Season } from '@/types/season'
import type { Match, SeatZone } from '@/types/match'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const TICKET_TYPE_LABEL: Record<string, string> = {
  TICKET: '일반',
  VIP_TICKET: 'VIP',
  COMPLIMENTARY: '무료',
}
const TICKET_TYPES = ['TICKET', 'VIP_TICKET', 'COMPLIMENTARY'] as const
type TicketType = typeof TICKET_TYPES[number]

const CHANNEL_LABEL: Record<string, string> = {
  ONLINE: '온라인',
  ONSITE: '현장',
  PARTNER: '제휴처',
  SEASON_PASS: '시즌권',
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  COMPLETED: { label: '완료', className: 'text-green-600' },
  CANCELLED: { label: '취소', className: 'text-red-500' },
  REFUNDED: { label: '환불', className: 'text-orange-500' },
}

const RECENT_MATCHES = 5
const PAGE_SIZE = 5

const emptyForm = () => ({
  matchId: '',
  type: 'TICKET' as TicketType,
  quantity: '',
  unitPrice: '',
  saleDate: new Date().toISOString().slice(0, 10),
  description: '',
  seatZoneId: '',
  channel: '',
})

const emptyCancelForm = () => ({
  quantity: '',
  saleDate: new Date().toISOString().slice(0, 10),
  description: '',
})

export function TicketSalesPage() {
  const { user } = useCurrentUser()
  const canWrite = !!user && (
    ['ADMIN', 'SUPER_ADMIN', 'GM'].includes(user.role) ||
    (user.role === 'FRONT_OFFICE' && (user.frontOfficeRole === 'FINANCE_MANAGER' || user.frontOfficeRole === 'FINANCE_STAFF'))
  )

  const [seasons, setSeasons] = useState<Season[]>([])
  const [selectedSeasonId, setSelectedSeasonId] = useState<number | null>(null)
  const [summary, setSummary] = useState<TicketMatchSummary[]>([])
  const [records, setRecords] = useState<SalesRecord[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')

  const [createOpen, setCreateOpen] = useState(false)
  const [editRecord, setEditRecord] = useState<SalesRecord | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm())

  const [seatZones, setSeatZones] = useState<SeatZone[]>([])
  const [cancelTarget, setCancelTarget] = useState<SalesRecord | null>(null)
  const [cancelForm, setCancelForm] = useState(emptyCancelForm())
  const [cancelling, setCancelling] = useState(false)

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
    setPage(1)
    Promise.all([
      salesApi.ticketSummary(selectedSeasonId),
      salesApi.ticketsBySeason(selectedSeasonId),
      matchApi.list({ seasonId: selectedSeasonId }),
    ]).then(([s, r, m]) => {
      setSummary(s)
      setRecords(r)
      setMatches(m)
    }).catch(() => toast.error('데이터 로드에 실패했습니다.'))
      .finally(() => setLoading(false))
  }, [selectedSeasonId])

  const reload = async () => {
    if (!selectedSeasonId) return
    const [s, r] = await Promise.all([
      salesApi.ticketSummary(selectedSeasonId),
      salesApi.ticketsBySeason(selectedSeasonId),
    ])
    setSummary(s)
    setRecords(r)
  }

  const filteredSummary = summary.filter((m) => {
    const d = m.date.slice(0, 10)
    if (filterFrom && d < filterFrom) return false
    if (filterTo && d > filterTo) return false
    return true
  })

  const filteredRecords = records.filter((r) => {
    const d = (r.match?.date ?? '').slice(0, 10)
    if (filterFrom && d < filterFrom) return false
    if (filterTo && d > filterTo) return false
    return true
  })

  const totalRevenue = filteredSummary.reduce((s, m) => s + m.totalAmount, 0)
  const seasonNetSold = filteredSummary.reduce((s, m) => s + m.netSold, 0)
  const seasonCapacityTotal = filteredSummary.reduce((s, m) => s + (m.capacity ?? 0), 0)
  const seasonSellRate = seasonCapacityTotal > 0
    ? Math.round(seasonNetSold / seasonCapacityTotal * 1000) / 10
    : null
  const recentSummary = filteredSummary.slice(0, RECENT_MATCHES)

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE))
  const pagedRecords = filteredRecords.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  useEffect(() => { setPage(1) }, [filterFrom, filterTo])

  const openCreate = () => { setForm(emptyForm()); setSeatZones([]); setCreateOpen(true) }

  const openEdit = (r: SalesRecord) => {
    setEditRecord(r)
    setForm({
      matchId: r.matchId?.toString() ?? '',
      type: r.type as TicketType,
      quantity: String(r.quantity),
      unitPrice: String(r.unitPrice),
      saleDate: r.saleDate.slice(0, 10),
      description: r.description ?? '',
      seatZoneId: r.seatZoneId?.toString() ?? '',
      channel: r.channel ?? '',
    })
  }

  const handleMatchChange = async (matchId: string) => {
    const match = matches.find((m) => m.id.toString() === matchId)
    setForm((prev) => ({
      ...prev,
      matchId,
      unitPrice: match?.priceRegular ? String(match.priceRegular) : prev.unitPrice,
      seatZoneId: '',
    }))
    setSeatZones([])
    if (matchId) {
      try {
        const zones = await salesApi.seatZones(Number(matchId))
        setSeatZones(zones)
      } catch {
        // seat zones are optional, ignore errors
      }
    }
  }

  const handleCreate = async () => {
    const qty = Number(form.quantity)
    const price = Number(form.unitPrice)
    if (!form.matchId || !qty || !price || !form.saleDate) {
      toast.error('경기, 수량, 단가, 날짜를 입력해주세요.')
      return
    }
    setSaving(true)
    try {
      await salesApi.create({
        type: form.type,
        quantity: qty,
        unitPrice: price,
        saleDate: form.saleDate,
        matchId: Number(form.matchId),
        ...(form.description && { description: form.description }),
        ...(form.seatZoneId && { seatZoneId: Number(form.seatZoneId) }),
        ...(form.channel && { channel: form.channel as any }),
      })
      toast.success('저장됐습니다.')
      setCreateOpen(false)
      await reload()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '저장 실패')
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async () => {
    if (!editRecord) return
    const qty = Number(form.quantity)
    const price = Number(form.unitPrice)
    if (!qty || !price || !form.saleDate) {
      toast.error('수량, 단가, 날짜를 입력해주세요.')
      return
    }
    setSaving(true)
    try {
      await salesApi.update(editRecord.id, {
        quantity: qty,
        unitPrice: price,
        saleDate: form.saleDate,
        description: form.description || undefined,
      })
      toast.success('수정됐습니다.')
      setEditRecord(null)
      await reload()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '수정 실패')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('이 판매 기록을 삭제하시겠습니까?')) return
    try {
      await salesApi.delete(id)
      toast.success('삭제됐습니다.')
      await reload()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '삭제 실패')
    }
  }

  const openCancel = (r: SalesRecord) => {
    setCancelTarget(r)
    setCancelForm(emptyCancelForm())
  }

  const handleCancel = async () => {
    if (!cancelTarget) return
    const qty = Number(cancelForm.quantity)
    if (!qty || !cancelForm.saleDate) {
      toast.error('취소 수량과 날짜를 입력해주세요.')
      return
    }
    if (qty > cancelTarget.quantity) {
      toast.error(`최대 취소 가능 수량은 ${cancelTarget.quantity}장입니다.`)
      return
    }
    setCancelling(true)
    try {
      await salesApi.cancel(cancelTarget.id, {
        quantity: qty,
        saleDate: cancelForm.saleDate,
        ...(cancelForm.description && { description: cancelForm.description }),
      })
      toast.success('취소 처리됐습니다.')
      setCancelTarget(null)
      await reload()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '취소 처리 실패')
    } finally {
      setCancelling(false)
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">티켓 판매 기록</h1>
          <p className="text-sm text-muted-foreground mt-0.5">홈경기별 티켓 판매 실적을 조회합니다.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={selectedSeasonId?.toString() ?? ''}
            onValueChange={(v) => setSelectedSeasonId(Number(v))}
          >
            <SelectTrigger className="w-40">
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
          {canWrite && <Button onClick={openCreate}>판매 등록</Button>}
        </div>
      </div>

      {/* 경기일 날짜 필터 */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-muted-foreground shrink-0">경기일</span>
        <Input
          type="date"
          className="w-38"
          value={filterFrom}
          onChange={(e) => setFilterFrom(e.target.value)}
        />
        <span className="text-sm text-muted-foreground">~</span>
        <Input
          type="date"
          className="w-38"
          value={filterTo}
          onChange={(e) => setFilterTo(e.target.value)}
        />
        {(filterFrom || filterTo) && (
          <Button size="sm" variant="ghost" onClick={() => { setFilterFrom(''); setFilterTo('') }}>
            초기화
          </Button>
        )}
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-4">
        {loading ? (
          <>
            <Skeleton className="h-20 rounded-lg" />
            <Skeleton className="h-20 rounded-lg" />
            <Skeleton className="h-20 rounded-lg" />
          </>
        ) : (
          <>
            <div className="border rounded-lg p-4">
              <p className="text-sm text-muted-foreground">시즌 수입</p>
              <p className="text-2xl font-bold mt-1">₩{totalRevenue.toLocaleString()}</p>
            </div>
            <div className="border rounded-lg p-4">
              <p className="text-sm text-muted-foreground">순판매량</p>
              <p className="text-2xl font-bold mt-1">{seasonNetSold.toLocaleString()}장</p>
            </div>
            <div className="border rounded-lg p-4">
              <p className="text-sm text-muted-foreground">판매율</p>
              <p className="text-2xl font-bold mt-1">
                {seasonSellRate !== null ? `${seasonSellRate}%` : '-'}
              </p>
            </div>
          </>
        )}
      </div>

      {/* 경기별 요약 — 최근 5경기 */}
      <div className="space-y-2">
        <h2 className="text-base font-semibold">경기별 요약 <span className="text-sm text-muted-foreground font-normal">(최근 {RECENT_MATCHES}경기)</span></h2>
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>경기일</TableHead>
                <TableHead>홈</TableHead>
                <TableHead>어웨이</TableHead>
                <TableHead className="text-right">판매량</TableHead>
                <TableHead className="text-right">순판매</TableHead>
                <TableHead className="text-right">판매율</TableHead>
                <TableHead className="text-right">수입</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8">
                    <div className="space-y-2 px-4">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="h-6 w-full" />
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {!loading && recentSummary.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    경기 일정이 없습니다.
                  </TableCell>
                </TableRow>
              )}
              {recentSummary.map((m) => (
                <TableRow key={m.matchId}>
                  <TableCell>
                    {new Date(m.date).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </TableCell>
                  <TableCell className="font-medium">{m.homeTeamName}</TableCell>
                  <TableCell>{m.awayTeamName}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {m.totalSold > 0 ? `${m.totalSold.toLocaleString()}장` : '-'}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {m.netSold > 0 ? `${m.netSold.toLocaleString()}장` : '-'}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {m.sellRate !== null ? `${m.sellRate}%` : '-'}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {m.totalAmount > 0 ? `₩${m.totalAmount.toLocaleString()}` : '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* 전체 판매 기록 — 5개씩 페이징 */}
      <div className="space-y-2">
        <h2 className="text-base font-semibold">전체 판매 기록</h2>
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>날짜</TableHead>
                <TableHead>경기</TableHead>
                <TableHead>종류</TableHead>
                <TableHead>채널</TableHead>
                <TableHead>상태</TableHead>
                <TableHead className="text-right">수량</TableHead>
                <TableHead className="text-right">단가</TableHead>
                <TableHead className="text-right">합계</TableHead>
                <TableHead>메모</TableHead>
                {canWrite && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={canWrite ? 10 : 9} className="text-center text-muted-foreground py-8">
                    판매 기록이 없습니다.
                  </TableCell>
                </TableRow>
              )}
              {pagedRecords.map((r) => {
                const statusBadge = STATUS_BADGE[r.status] ?? STATUS_BADGE['COMPLETED']
                const isCompleted = r.status === 'COMPLETED' || !r.status
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      {new Date(r.saleDate).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </TableCell>
                    <TableCell>
                      {r.match
                        ? `${r.match.homeTeamName} vs ${r.match.awayTeamName}`
                        : <span className="text-muted-foreground text-xs">미연결</span>}
                    </TableCell>
                    <TableCell className="text-sm">{TICKET_TYPE_LABEL[r.type] ?? r.type}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.channel ? CHANNEL_LABEL[r.channel] ?? r.channel : '-'}
                    </TableCell>
                    <TableCell>
                      <span className={`text-xs font-medium ${statusBadge.className}`}>
                        {statusBadge.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{r.quantity.toLocaleString()}</TableCell>
                    <TableCell className="text-right">₩{Number(r.unitPrice).toLocaleString()}</TableCell>
                    <TableCell className="text-right font-medium">₩{Number(r.totalAmount).toLocaleString()}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{r.description ?? '-'}</TableCell>
                    {canWrite && (
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          {isCompleted && (
                            <>
                              <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>수정</Button>
                              <Button size="sm" variant="ghost" className="text-orange-500" onClick={() => openCancel(r)}>취소</Button>
                              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => void handleDelete(r.id)}>삭제</Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-1">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>이전</Button>
            <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
            <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>다음</Button>
          </div>
        )}
      </div>

      {/* 판매 등록 다이얼로그 */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>티켓 판매 등록</DialogTitle></DialogHeader>
          <SaleForm
            form={form}
            setForm={setForm}
            matches={matches}
            seatZones={seatZones}
            showMatchSelect
            saving={saving}
            onSubmit={() => void handleCreate()}
            onMatchChange={(v) => void handleMatchChange(v)}
            submitLabel="저장"
          />
        </DialogContent>
      </Dialog>

      {/* 수정 다이얼로그 */}
      <Dialog open={!!editRecord} onOpenChange={(o) => { if (!o) setEditRecord(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>판매 기록 수정</DialogTitle></DialogHeader>
          <SaleForm
            form={form}
            setForm={setForm}
            matches={matches}
            seatZones={seatZones}
            showMatchSelect={false}
            saving={saving}
            onSubmit={() => void handleUpdate()}
            submitLabel="수정 저장"
          />
        </DialogContent>
      </Dialog>

      {/* 취소 다이얼로그 */}
      <Dialog open={!!cancelTarget} onOpenChange={(o) => { if (!o) setCancelTarget(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>티켓 판매 취소</DialogTitle></DialogHeader>
          {cancelTarget && (
            <div className="space-y-3 pt-1">
              <div className="text-sm text-muted-foreground border rounded-lg p-3 space-y-1">
                <p>
                  <span className="font-medium">경기:</span>{' '}
                  {cancelTarget.match
                    ? `${cancelTarget.match.homeTeamName} vs ${cancelTarget.match.awayTeamName}`
                    : '-'}
                </p>
                <p><span className="font-medium">종류:</span> {TICKET_TYPE_LABEL[cancelTarget.type] ?? cancelTarget.type}</p>
                <p><span className="font-medium">원래 수량:</span> {cancelTarget.quantity.toLocaleString()}장</p>
                <p><span className="font-medium">단가:</span> ₩{Number(cancelTarget.unitPrice).toLocaleString()}</p>
              </div>
              <div className="space-y-1">
                <Label>취소 수량 (최대 {cancelTarget.quantity}장)</Label>
                <Input
                  type="number"
                  min={1}
                  max={cancelTarget.quantity}
                  value={cancelForm.quantity}
                  onChange={(e) => setCancelForm((prev) => ({ ...prev, quantity: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1">
                <Label>취소 날짜</Label>
                <Input
                  type="date"
                  value={cancelForm.saleDate}
                  onChange={(e) => setCancelForm((prev) => ({ ...prev, saleDate: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>메모 (선택)</Label>
                <Input
                  value={cancelForm.description}
                  onChange={(e) => setCancelForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="취소 사유"
                />
              </div>
              {cancelForm.quantity && (
                <p className="text-sm text-muted-foreground">
                  취소 금액: ₩{(Number(cancelForm.quantity) * Number(cancelTarget.unitPrice)).toLocaleString()}
                </p>
              )}
              <Button className="w-full" variant="destructive" onClick={() => void handleCancel()} disabled={cancelling}>
                {cancelling ? '처리 중...' : '취소 처리'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface SaleFormProps {
  form: ReturnType<typeof emptyForm>
  setForm: React.Dispatch<React.SetStateAction<ReturnType<typeof emptyForm>>>
  matches: Match[]
  seatZones: SeatZone[]
  showMatchSelect: boolean
  saving: boolean
  onSubmit: () => void
  onMatchChange?: (matchId: string) => void
  submitLabel: string
}

function SaleForm({ form, setForm, matches, seatZones, showMatchSelect, saving, onSubmit, onMatchChange, submitLabel }: SaleFormProps) {
  const f = <K extends keyof ReturnType<typeof emptyForm>>(key: K) =>
    (val: ReturnType<typeof emptyForm>[K]) => setForm((prev) => ({ ...prev, [key]: val }))

  return (
    <div className="space-y-3 pt-1">
      {showMatchSelect && (
        <div className="space-y-1">
          <Label>경기</Label>
          <Select
            value={form.matchId}
            onValueChange={(v) => {
              const match = matches.find((m) => m.id.toString() === v)
              setForm((prev) => ({
                ...prev,
                matchId: v,
                unitPrice: match?.priceRegular ? String(match.priceRegular) : prev.unitPrice,
                seatZoneId: '',
              }))
              onMatchChange?.(v)
            }}
          >
            <SelectTrigger><SelectValue placeholder="경기 선택" /></SelectTrigger>
            <SelectContent>
              {matches.map((m) => (
                <SelectItem key={m.id} value={m.id.toString()}>
                  {new Date(m.date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })} {m.homeTeamName} vs {m.awayTeamName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="space-y-1">
        <Label>종류</Label>
        <Select
          value={form.type}
          onValueChange={(v) => {
            const tp = v as TicketType
            const match = matches.find((m) => m.id.toString() === form.matchId)
            const autoPrice = tp === 'VIP_TICKET' ? match?.priceVip : match?.priceRegular
            setForm((prev) => ({
              ...prev,
              type: tp,
              unitPrice: autoPrice ? String(autoPrice) : prev.unitPrice,
            }))
          }}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {TICKET_TYPES.map((tp) => (
              <SelectItem key={tp} value={tp}>{TICKET_TYPE_LABEL[tp]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {seatZones.length > 0 && (
        <div className="space-y-1">
          <Label>좌석 구역 (선택)</Label>
          <Select
            value={form.seatZoneId}
            onValueChange={(v) => {
              const zone = seatZones.find((z) => z.id.toString() === v)
              setForm((prev) => ({
                ...prev,
                seatZoneId: v,
                unitPrice: zone?.unitPrice ? String(zone.unitPrice) : prev.unitPrice,
              }))
            }}
          >
            <SelectTrigger><SelectValue placeholder="구역 선택" /></SelectTrigger>
            <SelectContent>
              {seatZones.map((z) => (
                <SelectItem key={z.id} value={z.id.toString()}>
                  {z.name}{z.unitPrice ? ` (₩${z.unitPrice.toLocaleString()})` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="space-y-1">
        <Label>판매 채널 (선택)</Label>
        <Select
          value={form.channel}
          onValueChange={f('channel')}
        >
          <SelectTrigger><SelectValue placeholder="채널 선택" /></SelectTrigger>
          <SelectContent>
            {Object.entries(CHANNEL_LABEL).map(([val, label]) => (
              <SelectItem key={val} value={val}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>수량</Label>
          <Input type="number" min={1} value={form.quantity} onChange={(e) => f('quantity')(e.target.value)} placeholder="0" />
        </div>
        <div className="space-y-1">
          <Label>단가 (₩)</Label>
          <Input type="number" min={0} value={form.unitPrice} onChange={(e) => f('unitPrice')(e.target.value)} placeholder="0" />
        </div>
      </div>
      <div className="space-y-1">
        <Label>판매일</Label>
        <Input type="date" value={form.saleDate} onChange={(e) => f('saleDate')(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label>메모 (선택)</Label>
        <Input value={form.description} onChange={(e) => f('description')(e.target.value)} placeholder="비고" />
      </div>
      <Button className="w-full" onClick={onSubmit} disabled={saving}>
        {saving ? '저장 중...' : submitLabel}
      </Button>
    </div>
  )
}
