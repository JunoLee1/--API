import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { transferApi } from '@/services/transfer.service'
import type { Transfer, Recall, TransferType } from '@/types/transfer'
import {
  TRANSFER_TYPE_STYLE,
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
import { Download, Plus } from 'lucide-react'

const TYPES: TransferType[] = ['PERMANENT_IN', 'PERMANENT_OUT', 'LOAN_OUT', 'LOAN_IN', 'FREE', 'RELEASE']

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
  const { t } = useTranslation('contract')
  const [type, setType] = useState<TransferType>('PERMANENT_IN')
  const [date, setDate] = useState('')
  const [fromClub, setFromClub] = useState('')
  const [toClub, setToClub] = useState('')
  const [fee, setFee] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!date) { toast.error(t('transfers.createDialog.required')); return }
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
      toast.success(t('transfers.createDialog.saved'))
      onSaved()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('transfers.createDialog.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{t('transfers.createDialog.title')}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>{t('transfers.createDialog.type')}</Label>
            <Select value={type} onValueChange={(v) => setType(v as TransferType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TYPES.map((tp) => <SelectItem key={tp} value={tp}>{t(`transfers.type.${tp}`)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t('transfers.createDialog.date')}</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>{t('transfers.createDialog.fromClub')}</Label>
              <Input placeholder={t('transfers.createDialog.fromClubPlaceholder')} value={fromClub} onChange={(e) => setFromClub(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('transfers.createDialog.toClub')}</Label>
              <Input placeholder={t('transfers.createDialog.toClubPlaceholder')} value={toClub} onChange={(e) => setToClub(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t('transfers.createDialog.fee')}</Label>
            <Input type="number" placeholder={t('transfers.createDialog.feePlaceholder')} value={fee} onChange={(e) => setFee(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>{t('transfers.createDialog.cancel')}</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? t('transfers.createDialog.saving') : t('transfers.createDialog.submit')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function TransfersPage() {
  const { t } = useTranslation('contract')
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
  const canExport =
    user?.role === 'ADMIN' ||
    (user?.role === 'FRONT_OFFICE' && ['GM', 'TD'].includes(user?.frontOfficeRole ?? ''))

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
      .catch(() => toast.error(t('transfers.loadFailed')))
      .finally(() => setLoadingTransfers(false))
  }

  const handleExport = async (id: number, playerName: string) => {
    try {
      const data = await transferApi.exportLoanIn(id)
      const json = JSON.stringify(data, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `loan_in_export_${playerName}_${id}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error(t('transfers.exportFailed'))
    }
  }

  const handleRecallAction = async (id: number, status: 'APPROVED' | 'REJECTED') => {
    try {
      await transferApi.updateRecallStatus(id, status)
      toast.success(status === 'APPROVED' ? t('transfers.recallApproved') : t('transfers.recallRejected'))
      const updated = await transferApi.recalls()
      setRecalls(updated)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('transfers.recallFailed'))
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 shrink-0">
        <h1 className="text-lg font-semibold tracking-tight">{t('transfers.title')}</h1>
      </div>

      <div className="flex-1 overflow-hidden">
        <Tabs defaultValue="transfers" className="h-full flex flex-col">
          <div className="border-b px-6 shrink-0">
            <TabsList className="h-9 bg-transparent p-0 gap-4">
              <TabsTrigger value="transfers" className="h-9 rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent">
                {t('transfers.tabTransfers')}
              </TabsTrigger>
              <TabsTrigger value="recalls" className="h-9 rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent">
                {t('transfers.tabRecalls')}
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
                  <SelectTrigger className="w-56 h-8 text-sm bg-background"><SelectValue placeholder={t('transfers.playerSelectPlaceholder')} /></SelectTrigger>
                  <SelectContent>
                    {players.map((p) => <SelectItem key={p.id} value={p.id}>{p.playerName}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              {canWrite && selectedPlayerId && (
                <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" />{t('transfers.addBtn')}
                </Button>
              )}
            </div>
            <div className="flex-1 overflow-auto">
              {!selectedPlayerId ? (
                <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">{t('transfers.selectPlayer')}</div>
              ) : loadingTransfers ? (
                <div className="p-6 space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
              ) : transfers.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">{t('transfers.noHistory')}</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>{t('transfers.col.type')}</TableHead>
                      <TableHead>{t('transfers.col.date')}</TableHead>
                      <TableHead>{t('transfers.col.fromClub')}</TableHead>
                      <TableHead>{t('transfers.col.toClub')}</TableHead>
                      <TableHead>{t('transfers.col.fee')}</TableHead>
                      <TableHead>{t('transfers.col.recall')}</TableHead>
                      {canExport && <TableHead className="w-24">{t('transfers.col.export')}</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transfers.map((tr) => (
                      <TableRow key={tr.id}>
                        <TableCell>
                          <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs ${TRANSFER_TYPE_STYLE[tr.type]}`}>
                            {t(`transfers.type.${tr.type}`)}
                          </span>
                        </TableCell>
                        <TableCell className="tabular-nums">{formatDate(tr.date)}</TableCell>
                        <TableCell>{tr.fromClub ?? '—'}</TableCell>
                        <TableCell>{tr.toClub ?? '—'}</TableCell>
                        <TableCell className="tabular-nums">{formatFee(tr.fee)}</TableCell>
                        <TableCell>
                          {tr.recall ? (
                            <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs ${RECALL_STATUS_STYLE[tr.recall.status]}`}>
                              {t(`transfers.recall.${tr.recall.status}`)}
                            </span>
                          ) : '—'}
                        </TableCell>
                        {canExport && (
                          <TableCell>
                            {tr.type === 'LOAN_IN' ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                onClick={(e) => { e.stopPropagation(); handleExport(tr.id, '') }}
                              >
                                <Download className="h-3 w-3 mr-1" />{t('transfers.exportBtn')}
                              </Button>
                            ) : '—'}
                          </TableCell>
                        )}
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
              <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">{t('transfers.noRecalls')}</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>{t('transfers.col.transferId')}</TableHead>
                    <TableHead>{t('transfers.col.status')}</TableHead>
                    {canApproveRecall && <TableHead className="w-40">{t('transfers.col.action')}</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recalls.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="tabular-nums">#{r.transferId}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs ${RECALL_STATUS_STYLE[r.status]}`}>
                          {t(`transfers.recall.${r.status}`)}
                        </span>
                      </TableCell>
                      {canApproveRecall && (
                        <TableCell>
                          {r.status === 'PENDING' ? (
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleRecallAction(r.id, 'APPROVED')}>{t('transfers.approveBtn')}</Button>
                              <Button size="sm" variant="outline" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => handleRecallAction(r.id, 'REJECTED')}>{t('transfers.rejectBtn')}</Button>
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
