import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { callupApi } from '@/services/player-callup.service'
import type { PlayerCallup, PlayerCallupStatus, CreateCallupDto } from '@/types/player-callup'
import { CALLUP_STATUS_STYLE } from '@/types/player-callup'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { playerApi } from '@/services/player.service'
import type { Player } from '@/types/player'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Plus } from 'lucide-react'

const STATUS_FILTER_KEYS = ['ALL', 'REQUESTED', 'DOCS_SUBMITTED', 'APPROVED', 'REJECTED', 'COMPLETED'] as const

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ko-KR')
}

interface CreateDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSaved: () => void
}

function CreateDialog({ open, onOpenChange, onSaved }: CreateDialogProps) {
  const { t } = useTranslation('contract')
  const [youthPlayers, setYouthPlayers] = useState<Player[]>([])
  const [form, setForm] = useState<Partial<CreateCallupDto>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    playerApi.list({ level: 'YOUTH' }).then(setYouthPlayers).catch(() => null)
  }, [])

  const handlePlayerSelect = (playerId: string) => {
    const player = youthPlayers.find((p) => p.id === playerId)
    setForm((f) => ({ ...f, playerId, fromTeamId: player?.teamId ?? undefined }))
  }

  const handleSave = async () => {
    if (!form.playerId || !form.toTeamId || !form.reason?.trim() || !form.startDate) {
      toast.error(t('callup.createDialog.required'))
      return
    }
    setSaving(true)
    try {
      await callupApi.create(form as CreateCallupDto)
      toast.success(t('callup.createDialog.saved'))
      onSaved()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('callup.createDialog.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{t('callup.createDialog.title')}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>{t('callup.createDialog.player')}</Label>
            <Select
              value={form.playerId ?? ''}
              onValueChange={handlePlayerSelect}
            >
              <SelectTrigger><SelectValue placeholder={t('callup.createDialog.playerPlaceholder')} /></SelectTrigger>
              <SelectContent>
                {youthPlayers.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.playerName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t('callup.createDialog.toTeamId')}</Label>
            <Input
              type="number"
              placeholder={t('callup.createDialog.toTeamIdPlaceholder')}
              value={form.toTeamId ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, toTeamId: Number(e.target.value) }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t('callup.createDialog.reason')}</Label>
            <Textarea
              placeholder={t('callup.createDialog.reasonPlaceholder')}
              value={form.reason ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              rows={2}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t('callup.createDialog.startDate')}</Label>
            <Input
              type="date"
              value={form.startDate ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t('callup.createDialog.endDate')}</Label>
            <Input
              type="date"
              value={form.endDate ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value || undefined }))}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>{t('callup.createDialog.cancel')}</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? t('callup.createDialog.saving') : t('callup.createDialog.submit')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function PlayerCallupPage() {
  const { t } = useTranslation('contract')
  const { user } = useCurrentUser()
  const [callups, setCallups] = useState<PlayerCallup[]>([])
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [rejectId, setRejectId] = useState<number | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const isHeadCoach = user?.coachingRole === 'HEAD_COACH'
  const isGM = user?.role === 'GM'
  const isMedical = user?.coachingRole === 'MEDICAL'

  const fetchCallups = () => {
    setLoading(true)
    callupApi.list(statusFilter === 'ALL' ? undefined : statusFilter)
      .then(setCallups)
      .catch(() => toast.error(t('callup.loadFailed')))
      .finally(() => setLoading(false))
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchCallups() }, [statusFilter])

  const handleApprove = async (id: number) => {
    try {
      await callupApi.approve(id)
      toast.success(t('callup.approved'))
      fetchCallups()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('callup.approveFailed'))
    }
  }

  const handleReject = async () => {
    if (!rejectId || !rejectReason.trim()) return
    try {
      await callupApi.reject(rejectId, rejectReason)
      toast.success(t('callup.rejected'))
      setRejectId(null)
      setRejectReason('')
      fetchCallups()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('callup.rejectFailed'))
    }
  }

  const handleComplete = async (id: number) => {
    try {
      await callupApi.complete(id)
      toast.success(t('callup.completed'))
      fetchCallups()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('callup.actionFailed'))
    }
  }

  const handleConfirmYouth = async (id: number) => {
    try {
      await callupApi.confirmYouth(id)
      toast.success(t('callup.youthConfirmed'))
      fetchCallups()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('callup.actionFailed'))
    }
  }

  const handleConfirmMedical = async (id: number) => {
    try {
      await callupApi.confirmMedical(id)
      toast.success(t('callup.medicalConfirmed'))
      fetchCallups()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('callup.actionFailed'))
    }
  }

  const showActions = isGM || isHeadCoach || isMedical

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 flex items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">{t('callup.title')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('callup.totalCount', { count: callups.length })}</p>
        </div>
        {isHeadCoach && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />{t('callup.addBtn')}
          </Button>
        )}
      </div>

      <div className="border-b px-6 py-3 flex items-center gap-3 shrink-0 bg-muted/30">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-32 h-8 text-sm bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTER_KEYS.map((key) => (
              <SelectItem key={key} value={key}>
                {key === 'ALL' ? t('callup.statusAll') : t(`callup.status.${key}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : callups.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
            {t('callup.noData')}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>{t('callup.col.player')}</TableHead>
                <TableHead>{t('callup.col.teams')}</TableHead>
                <TableHead className="w-28">{t('callup.col.period')}</TableHead>
                <TableHead className="w-20 text-center">{t('callup.col.status')}</TableHead>
                <TableHead className="w-32 text-center">{t('callup.col.docsCheck')}</TableHead>
                {showActions && <TableHead className="w-44" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {callups.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.player.playerName}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {c.fromTeam.name} → {c.toTeam.name}
                  </TableCell>
                  <TableCell className="text-xs tabular-nums">
                    {formatDate(c.startDate)}
                    {c.endDate ? ` ~ ${formatDate(c.endDate)}` : ' ~'}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={`inline-flex rounded border px-1.5 py-0.5 text-xs ${CALLUP_STATUS_STYLE[c.status as PlayerCallupStatus]}`}>
                      {t(`callup.status.${c.status}`)}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex flex-col gap-0.5 items-center text-xs">
                      <span className={c.youthCoachConfirmed ? 'text-green-600' : 'text-muted-foreground'}>
                        {t('callup.docsYouth')} {c.youthCoachConfirmed ? '✓' : t('callup.docsPending')}
                      </span>
                      <span className={c.medicalConfirmed ? 'text-green-600' : 'text-muted-foreground'}>
                        {t('callup.docsMedical')} {c.medicalConfirmed ? '✓' : t('callup.docsPending')}
                      </span>
                    </div>
                  </TableCell>
                  {showActions && (
                    <TableCell className="flex gap-1.5">
                      {isHeadCoach && c.status === 'REQUESTED' && !c.youthCoachConfirmed && user?.teamId === c.fromTeam.id && (
                        <Button size="sm" variant="outline" className="h-7 text-xs"
                          onClick={() => handleConfirmYouth(c.id)}>
                          {t('callup.confirmYouth')}
                        </Button>
                      )}
                      {isMedical && c.status === 'REQUESTED' && !c.medicalConfirmed && (
                        <Button size="sm" variant="outline" className="h-7 text-xs"
                          onClick={() => handleConfirmMedical(c.id)}>
                          {t('callup.confirmMedical')}
                        </Button>
                      )}
                      {isGM && c.status === 'DOCS_SUBMITTED' && (
                        <>
                          <Button size="sm" variant="outline" className="h-7 text-xs"
                            onClick={() => handleApprove(c.id)}>
                            {t('callup.approveBtn')}
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs text-red-600"
                            onClick={() => setRejectId(c.id)}>
                            {t('callup.rejectBtn')}
                          </Button>
                        </>
                      )}
                      {(isGM || isHeadCoach) && c.status === 'APPROVED' && (
                        <Button size="sm" variant="outline" className="h-7 text-xs"
                          onClick={() => handleComplete(c.id)}>
                          {t('callup.completeBtn')}
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <CreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={() => { setCreateOpen(false); fetchCallups() }}
      />

      <Dialog open={rejectId !== null} onOpenChange={(v) => !v && setRejectId(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle>{t('callup.rejectDialog.title')}</DialogTitle></DialogHeader>
          <Textarea
            placeholder={t('callup.rejectDialog.placeholder')}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectId(null)}>{t('callup.rejectDialog.cancel')}</Button>
            <Button onClick={handleReject} disabled={!rejectReason.trim()}>{t('callup.rejectDialog.confirm')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
