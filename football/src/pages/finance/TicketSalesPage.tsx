import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
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

const TICKET_TYPES = ['TICKET', 'VIP_TICKET', 'COMPLIMENTARY'] as const
type TicketType = typeof TICKET_TYPES[number]

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
  const { t } = useTranslation('finance')
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

  const TICKET_TYPE_LABEL: Record<string, string> = {
    TICKET: t('ticketSales.ticketType.TICKET'),
    VIP_TICKET: t('ticketSales.ticketType.VIP_TICKET'),
    COMPLIMENTARY: t('ticketSales.ticketType.COMPLIMENTARY'),
  }

  const CHANNEL_LABEL: Record<string, string> = {
    ONLINE: t('ticketSales.channel.ONLINE'),
    ONSITE: t('ticketSales.channel.ONSITE'),
    PARTNER: t('ticketSales.channel.PARTNER'),
    SEASON_PASS: t('ticketSales.channel.SEASON_PASS'),
  }

  const STATUS_BADGE: Record<string, { label: string; className: string }> = {
    COMPLETED: { label: t('ticketSales.saleStatus.COMPLETED'), className: 'text-green-600' },
    CANCELLED: { label: t('ticketSales.saleStatus.CANCELLED'), className: 'text-red-500' },
    REFUNDED: { label: t('ticketSales.saleStatus.REFUNDED'), className: 'text-orange-500' },
  }

  useEffect(() => {
    seasonApi.list().then((list) => {
      setSeasons(list)
      const active = list.find((s) => s.status === 'ACTIVE') ?? list[0]
      if (active) setSelectedSeasonId(active.id)
    }).catch(() => toast.error(t('ticketSales.errors.seasonFailed')))
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
    }).catch(() => toast.error(t('ticketSales.errors.loadFailed')))
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
      toast.error(t('ticketSales.errors.createRequired'))
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
      toast.success(t('ticketSales.actions.saved'))
      setCreateOpen(false)
      await reload()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('ticketSales.errors.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async () => {
    if (!editRecord) return
    const qty = Number(form.quantity)
    const price = Number(form.unitPrice)
    if (!qty || !price || !form.saleDate) {
      toast.error(t('ticketSales.errors.updateRequired'))
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
      toast.success(t('ticketSales.actions.updated'))
      setEditRecord(null)
      await reload()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('ticketSales.errors.updateFailed'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm(t('ticketSales.actions.deleteConfirm'))) return
    try {
      await salesApi.delete(id)
      toast.success(t('ticketSales.actions.deleted'))
      await reload()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('ticketSales.errors.deleteFailed'))
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
      toast.error(t('ticketSales.errors.cancelRequired'))
      return
    }
    if (qty > cancelTarget.quantity) {
      toast.error(t('ticketSales.actions.maxCancelExceeded', { max: cancelTarget.quantity }))
      return
    }
    setCancelling(true)
    try {
      await salesApi.cancel(cancelTarget.id, {
        quantity: qty,
        saleDate: cancelForm.saleDate,
        ...(cancelForm.description && { description: cancelForm.description }),
      })
      toast.success(t('ticketSales.dialog.cancelInfo.cancelSuccess'))
      setCancelTarget(null)
      await reload()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('ticketSales.errors.cancelFailed'))
    } finally {
      setCancelling(false)
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t('ticketSales.title')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('ticketSales.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={selectedSeasonId?.toString() ?? ''}
            onValueChange={(v) => setSelectedSeasonId(Number(v))}
          >
            <SelectTrigger className="w-40">
              <span className={selectedSeasonId ? '' : 'text-muted-foreground'}>
                {seasons.find((s) => s.id === selectedSeasonId)?.name ?? t('ticketSales.seasonSelect')}
              </span>
            </SelectTrigger>
            <SelectContent>
              {seasons.map((s) => (
                <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {canWrite && <Button onClick={openCreate}>{t('ticketSales.registerSale')}</Button>}
        </div>
      </div>

      {/* 경기일 날짜 필터 */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-muted-foreground shrink-0">{t('ticketSales.dateFilter')}</span>
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
            {t('ticketSales.reset')}
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
              <p className="text-sm text-muted-foreground">{t('ticketSales.seasonTotal')}</p>
              <p className="text-2xl font-bold mt-1">₩{totalRevenue.toLocaleString()}</p>
            </div>
            <div className="border rounded-lg p-4">
              <p className="text-sm text-muted-foreground">{t('ticketSales.netSold')}</p>
              <p className="text-2xl font-bold mt-1">{seasonNetSold.toLocaleString()}장</p>
            </div>
            <div className="border rounded-lg p-4">
              <p className="text-sm text-muted-foreground">{t('ticketSales.sellRate')}</p>
              <p className="text-2xl font-bold mt-1">
                {seasonSellRate !== null ? `${seasonSellRate}%` : '-'}
              </p>
            </div>
          </>
        )}
      </div>

      {/* 경기별 요약 — 최근 5경기 */}
      <div className="space-y-2">
        <h2 className="text-base font-semibold">{t('ticketSales.matchSummary')} <span className="text-sm text-muted-foreground font-normal">({t('ticketSales.recentMatches', { count: RECENT_MATCHES })})</span></h2>
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('ticketSales.tableHeaders.date')}</TableHead>
                <TableHead>{t('ticketSales.tableHeaders.home')}</TableHead>
                <TableHead>{t('ticketSales.tableHeaders.away')}</TableHead>
                <TableHead className="text-right">{t('ticketSales.tableHeaders.sold')}</TableHead>
                <TableHead className="text-right">{t('ticketSales.tableHeaders.netSold')}</TableHead>
                <TableHead className="text-right">{t('ticketSales.tableHeaders.sellRate')}</TableHead>
                <TableHead className="text-right">{t('ticketSales.tableHeaders.revenue')}</TableHead>
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
                    {t('ticketSales.noSchedule')}
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
        <h2 className="text-base font-semibold">{t('ticketSales.allRecords')}</h2>
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('ticketSales.tableHeaders.saleDate')}</TableHead>
                <TableHead>{t('ticketSales.tableHeaders.match')}</TableHead>
                <TableHead>{t('ticketSales.tableHeaders.type')}</TableHead>
                <TableHead>{t('ticketSales.tableHeaders.channel')}</TableHead>
                <TableHead>{t('ticketSales.tableHeaders.status')}</TableHead>
                <TableHead className="text-right">{t('ticketSales.tableHeaders.quantity')}</TableHead>
                <TableHead className="text-right">{t('ticketSales.tableHeaders.unitPrice')}</TableHead>
                <TableHead className="text-right">{t('ticketSales.tableHeaders.total')}</TableHead>
                <TableHead>{t('ticketSales.tableHeaders.memo')}</TableHead>
                {canWrite && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={canWrite ? 10 : 9} className="text-center text-muted-foreground py-8">
                    {t('ticketSales.noRecords')}
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
                        : <span className="text-muted-foreground text-xs">{t('ticketSales.unlinked')}</span>}
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
                              <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>{t('ticketSales.actions.edit')}</Button>
                              <Button size="sm" variant="ghost" className="text-orange-500" onClick={() => openCancel(r)}>{t('ticketSales.actions.cancel')}</Button>
                              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => void handleDelete(r.id)}>{t('ticketSales.actions.delete')}</Button>
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
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{t('ticketSales.prev')}</Button>
            <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
            <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>{t('ticketSales.next')}</Button>
          </div>
        )}
      </div>

      {/* 판매 등록 다이얼로그 */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('ticketSales.dialog.createTitle')}</DialogTitle></DialogHeader>
          <SaleForm
            form={form}
            setForm={setForm}
            matches={matches}
            seatZones={seatZones}
            showMatchSelect
            saving={saving}
            onSubmit={() => void handleCreate()}
            onMatchChange={(v) => void handleMatchChange(v)}
            submitLabel={t('ticketSales.dialog.submitLabel')}
          />
        </DialogContent>
      </Dialog>

      {/* 수정 다이얼로그 */}
      <Dialog open={!!editRecord} onOpenChange={(o) => { if (!o) setEditRecord(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('ticketSales.dialog.editTitle')}</DialogTitle></DialogHeader>
          <SaleForm
            form={form}
            setForm={setForm}
            matches={matches}
            seatZones={seatZones}
            showMatchSelect={false}
            saving={saving}
            onSubmit={() => void handleUpdate()}
            submitLabel={t('ticketSales.dialog.editSubmitLabel')}
          />
        </DialogContent>
      </Dialog>

      {/* 취소 다이얼로그 */}
      <Dialog open={!!cancelTarget} onOpenChange={(o) => { if (!o) setCancelTarget(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('ticketSales.dialog.cancelTitle')}</DialogTitle></DialogHeader>
          {cancelTarget && (
            <div className="space-y-3 pt-1">
              <div className="text-sm text-muted-foreground border rounded-lg p-3 space-y-1">
                <p>
                  <span className="font-medium">{t('ticketSales.dialog.cancelInfo.match')}:</span>{' '}
                  {cancelTarget.match
                    ? `${cancelTarget.match.homeTeamName} vs ${cancelTarget.match.awayTeamName}`
                    : '-'}
                </p>
                <p><span className="font-medium">{t('ticketSales.dialog.cancelInfo.type')}:</span> {TICKET_TYPE_LABEL[cancelTarget.type] ?? cancelTarget.type}</p>
                <p><span className="font-medium">{t('ticketSales.dialog.cancelInfo.originalQty')}:</span> {cancelTarget.quantity.toLocaleString()}장</p>
                <p><span className="font-medium">{t('ticketSales.dialog.cancelInfo.unitPrice')}:</span> ₩{Number(cancelTarget.unitPrice).toLocaleString()}</p>
              </div>
              <div className="space-y-1">
                <Label>{t('ticketSales.dialog.cancelInfo.cancelQty', { max: cancelTarget.quantity })}</Label>
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
                <Label>{t('ticketSales.dialog.cancelInfo.cancelDate')}</Label>
                <Input
                  type="date"
                  value={cancelForm.saleDate}
                  onChange={(e) => setCancelForm((prev) => ({ ...prev, saleDate: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>{t('ticketSales.dialog.cancelInfo.cancelMemo')}</Label>
                <Input
                  value={cancelForm.description}
                  onChange={(e) => setCancelForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder={t('ticketSales.dialog.cancelInfo.cancelMemoPh')}
                />
              </div>
              {cancelForm.quantity && (
                <p className="text-sm text-muted-foreground">
                  {t('ticketSales.dialog.cancelInfo.cancelAmount')}₩{(Number(cancelForm.quantity) * Number(cancelTarget.unitPrice)).toLocaleString()}
                </p>
              )}
              <Button className="w-full" variant="destructive" onClick={() => void handleCancel()} disabled={cancelling}>
                {cancelling ? t('ticketSales.dialog.cancelInfo.cancelling') : t('ticketSales.dialog.cancelInfo.cancelAction')}
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
  const { t } = useTranslation('finance')

  const TICKET_TYPE_LABEL: Record<string, string> = {
    TICKET: t('ticketSales.ticketType.TICKET'),
    VIP_TICKET: t('ticketSales.ticketType.VIP_TICKET'),
    COMPLIMENTARY: t('ticketSales.ticketType.COMPLIMENTARY'),
  }

  const CHANNEL_LABEL: Record<string, string> = {
    ONLINE: t('ticketSales.channel.ONLINE'),
    ONSITE: t('ticketSales.channel.ONSITE'),
    PARTNER: t('ticketSales.channel.PARTNER'),
    SEASON_PASS: t('ticketSales.channel.SEASON_PASS'),
  }

  const f = <K extends keyof ReturnType<typeof emptyForm>>(key: K) =>
    (val: ReturnType<typeof emptyForm>[K]) => setForm((prev) => ({ ...prev, [key]: val }))

  return (
    <div className="space-y-3 pt-1">
      {showMatchSelect && (
        <div className="space-y-1">
          <Label>{t('ticketSales.dialog.match')}</Label>
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
            <SelectTrigger><SelectValue placeholder={t('ticketSales.dialog.matchSelect')} /></SelectTrigger>
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
        <Label>{t('ticketSales.dialog.type')}</Label>
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
          <Label>{t('ticketSales.dialog.seatZone')}</Label>
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
            <SelectTrigger><SelectValue placeholder={t('ticketSales.dialog.seatZoneSelect')} /></SelectTrigger>
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
        <Label>{t('ticketSales.dialog.channel')}</Label>
        <Select
          value={form.channel}
          onValueChange={f('channel')}
        >
          <SelectTrigger><SelectValue placeholder={t('ticketSales.dialog.channelSelect')} /></SelectTrigger>
          <SelectContent>
            {Object.entries(CHANNEL_LABEL).map(([val, label]) => (
              <SelectItem key={val} value={val}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>{t('ticketSales.dialog.quantity')}</Label>
          <Input type="number" min={1} value={form.quantity} onChange={(e) => f('quantity')(e.target.value)} placeholder="0" />
        </div>
        <div className="space-y-1">
          <Label>{t('ticketSales.dialog.unitPrice')}</Label>
          <Input type="number" min={0} value={form.unitPrice} onChange={(e) => f('unitPrice')(e.target.value)} placeholder="0" />
        </div>
      </div>
      <div className="space-y-1">
        <Label>{t('ticketSales.dialog.saleDate')}</Label>
        <Input type="date" value={form.saleDate} onChange={(e) => f('saleDate')(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label>{t('ticketSales.dialog.memo')}</Label>
        <Input value={form.description} onChange={(e) => f('description')(e.target.value)} placeholder={t('ticketSales.dialog.memoPh')} />
      </div>
      <Button className="w-full" onClick={onSubmit} disabled={saving}>
        {saving ? t('ticketSales.actions.saving') : submitLabel}
      </Button>
    </div>
  )
}
