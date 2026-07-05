import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { transferApi } from '@/services/transfer.service'
import type { Transfer, Recall, TransferType } from '@/types/transfer'
import {
  TRANSFER_TYPE_LABEL,
  TRANSFER_TYPE_STYLE,
  RECALL_STATUS_LABEL,
  RECALL_STATUS_STYLE,
} from '@/types/transfer'
import { usePlayers } from '@/hooks/usePlayers'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus } from 'lucide-react'

const TYPES: TransferType[] = ['PERMANENT', 'LOAN_OUT', 'LOAN_IN', 'FREE', 'RELEASE']

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('ko-KR')
}

function formatFee(fee: number | null) {
  if (!fee) return '—'
  if (fee >= 100_000_000) return `${(fee / 100_000_000).toFixed(1)}억`
  if (fee >= 10_000) return `${Math.round(fee / 10_000)}만`
  return fee.toLocaleString()
}

interface CreateTransferDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  playerId: string
  onSaved: () => void
}

function CreateTransferDialog({ open, onOpenChange, playerId, onSaved }: CreateTransferDialogProps) {
  const [type, setType] = useState<TransferType>('PERMANENT')
  const [date, setDate] = useState('')
  const [fromClub, setFromClub] = useState('')
  const [toClub, setToClub] = useState('')
  const [fee, setFee] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!date) { toast.error('이적 날짜를 입력해주세요.'); return }
    setSaving(true)
    try {
      await transferApi.create({
        playerId,
        type,
        date,
        ...(fromClub && { fromClub }),
        ...(toClub && { toClub }),
        ...(fee && { fee: Number(fee) }),
      })
      toast.success('이적이 등록됐습니다.')
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
        <DialogHeader><DialogTitle>이적 등록</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>유형 *</Label>
            <Select value={type} onValueChange={(v) => setType(v as TransferType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => <SelectItem key={t} value={t}>{TRANSFER_TYPE_LABEL[t]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>이적 날짜 *</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>출발 클럽</Label>
              <Input placeholder="이전 소속" value={fromClub} onChange={(e) => setFromClub(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>도착 클럽</Label>
              <Input placeholder="새 소속" value={toClub} onChange={(e) => setToClub(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>이적료 (원)</Label>
            <Input type="number" placeholder="예: 5000000000" value={fee} onChange={(e) => setFee(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>취소</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? '저장 중...' : '등록'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function TransfersPage() {
  const { user } = useCurrentUser()
  const { players, loading: playersLoading } = usePlayers()
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('')
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [loadingTransfers, setLoadingTransfers] = useState(false)
  const [recalls, setRecalls] = useState<Recall[]>([])
  const [loadingRecalls, setLoadingRecalls] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)

  const canWrite = user?.role === 'ADMIN' || user?.role === 'FRONT_OFFICE'
  const canApproveRecall = user?.role === 'ADMIN'

  useEffect(() => {
    transferApi
      .recalls()
      .then(setRecalls)
      .catch(() => null)
      .finally(() => setLoadingRecalls(false))
  }, [])

  const fetchTransfers = (pid: string) => {
    setLoadingTransfers(true)
    transferApi
      .byPlayer(pid)
      .then(setTransfers)
      .catch(() => toast.error('이적 이력을 불러오지 못했습니다.'))
      .finally(() => setLoadingTransfers(false))
  }

  const handleRecallAction = async (id: number, status: 'APPROVED' | 'REJECTED') => {
    try {
      await transferApi.updateRecallStatus(id, status)
      toast.success(`복귀 요청이 ${status === 'APPROVED' ? '승인' : '거절'}됐습니다.`)
      const updated = await transferApi.recalls()
      setRecalls(updated)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '처리에 실패했습니다.')
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 shrink-0">
        <h1 className="text-lg font-semibold tracking-tight">이적 현황</h1>
      </div>

      <div className="flex-1 overflow-hidden">
        <Tabs defaultValue="transfers" className="h-full flex flex-col">
          <div className="border-b px-6 shrink-0">
            <TabsList className="h-9 bg-transparent p-0 gap-4">
              <TabsTrigger value="transfers" className="h-9 rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent">
                선수별 이적
              </TabsTrigger>
              <TabsTrigger value="recalls" className="h-9 rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent">
                복귀 요청
                {recalls.filter((r) => r.status === 'PENDING').length > 0 && (
                  <span className="ml-1.5 rounded-full bg-amber-500 text-white text-[10px] px-1.5 py-0.5">
                    {recalls.filter((r) => r.status === 'PENDING').length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* 선수별 이적 탭 */}
          <TabsContent value="transfers" className="flex-1 flex flex-col overflow-hidden mt-0">
            <div className="border-b px-6 py-3 flex items-center gap-3 shrink-0 bg-muted/30">
              {playersLoading ? <Skeleton className="h-8 w-56" /> : (
                <Select value={selectedPlayerId} onValueChange={(pid) => { if (pid) { setSelectedPlayerId(pid); setTransfers([]); fetchTransfers(pid) } }}>
                  <SelectTrigger className="w-56 h-8 text-sm bg-background"><SelectValue placeholder="선수 선택" /></SelectTrigger>
                  <SelectContent>
                    {players.map((p) => <SelectItem key={p.id} value={p.id}>{p.playerName}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              {canWrite && selectedPlayerId && (
                <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" />이적 등록
                </Button>
              )}
            </div>
            <div className="flex-1 overflow-auto">
              {!selectedPlayerId ? (
                <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">선수를 선택해주세요.</div>
              ) : loadingTransfers ? (
                <div className="p-6 space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
              ) : transfers.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">이적 이력이 없습니다.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>유형</TableHead>
                      <TableHead>이적일</TableHead>
                      <TableHead>출발 클럽</TableHead>
                      <TableHead>도착 클럽</TableHead>
                      <TableHead>이적료</TableHead>
                      <TableHead>복귀 요청</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transfers.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell>
                          <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs ${TRANSFER_TYPE_STYLE[t.type]}`}>
                            {TRANSFER_TYPE_LABEL[t.type]}
                          </span>
                        </TableCell>
                        <TableCell className="tabular-nums">{formatDate(t.date)}</TableCell>
                        <TableCell>{t.fromClub ?? '—'}</TableCell>
                        <TableCell>{t.toClub ?? '—'}</TableCell>
                        <TableCell className="tabular-nums">{formatFee(t.fee)}</TableCell>
                        <TableCell>
                          {t.recall ? (
                            <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs ${RECALL_STATUS_STYLE[t.recall.status]}`}>
                              {RECALL_STATUS_LABEL[t.recall.status]}
                            </span>
                          ) : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </TabsContent>

          {/* 복귀 요청 탭 */}
          <TabsContent value="recalls" className="flex-1 overflow-auto mt-0">
            {loadingRecalls ? (
              <div className="p-6 space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : recalls.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">복귀 요청이 없습니다.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>이적 ID</TableHead>
                    <TableHead>상태</TableHead>
                    {canApproveRecall && <TableHead className="w-40">처리</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recalls.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="tabular-nums">#{r.transferId}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs ${RECALL_STATUS_STYLE[r.status]}`}>
                          {RECALL_STATUS_LABEL[r.status]}
                        </span>
                      </TableCell>
                      {canApproveRecall && (
                        <TableCell>
                          {r.status === 'PENDING' ? (
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleRecallAction(r.id, 'APPROVED')}>승인</Button>
                              <Button size="sm" variant="outline" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => handleRecallAction(r.id, 'REJECTED')}>거절</Button>
                            </div>
                          ) : '—'}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {canWrite && selectedPlayerId && (
        <CreateTransferDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          playerId={selectedPlayerId}
          onSaved={() => { setCreateOpen(false); fetchTransfers(selectedPlayerId) }}
        />
      )}
    </div>
  )
}
