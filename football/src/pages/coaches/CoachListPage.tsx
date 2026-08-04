import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { coachApi } from '@/services/coach.service'
import type { Coach, CoachingRole, CoachStatus } from '@/types/coach'
import {
  COACH_STATUS_STYLE,
} from '@/types/coach'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { ArrowLeft, Plus } from 'lucide-react'

const ALL_ROLES: CoachingRole[] = [
  'HEAD_COACH', 'ASSISTANT_COACH', 'DEFENSIVE_COACH',
  'ATTACKING_COACH', 'GOALKEEPER_COACH', 'PHYSICAL_COACH', 'SET_PIECE_COACH',
]
const ALL_STATUSES: (CoachStatus | 'ALL')[] = [
  'ALL', 'CANDIDATE', 'SHORTLISTED', 'APPROVAL_PENDING', 'CONTRACTED', 'RETIRED', 'ARCHIVED',
]

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })
}

interface CreateCoachDialogProps {
  roundId: number | undefined
  open: boolean
  onOpenChange: (v: boolean) => void
  onSaved: () => void
}

function CreateCoachDialog({ roundId, open, onOpenChange, onSaved }: CreateCoachDialogProps) {
  const { t } = useTranslation('contract')
  const [name, setName] = useState('')
  const [nationality, setNationality] = useState('')
  const [coachingRole, setCoachingRole] = useState<CoachingRole | ''>('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim()) { toast.error(t('coaches.createDialog.requiredName')); return }
    if (!coachingRole) { toast.error(t('coaches.createDialog.requiredRole')); return }
    setSaving(true)
    try {
      await coachApi.create({
        name: name.trim(),
        coachingRole,
        ...(nationality.trim() && { nationality: nationality.trim() }),
        ...(notes.trim() && { notes: notes.trim() }),
        ...(roundId !== undefined && { hiringRoundId: roundId }),
      })
      toast.success(t('coaches.createDialog.saved'))
      setName(''); setNationality(''); setCoachingRole(''); setNotes('')
      onSaved()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('coaches.createDialog.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{t('coaches.createDialog.title')}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>{t('coaches.createDialog.name')}</Label>
            <Input placeholder={t('coaches.createDialog.namePlaceholder')} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t('coaches.createDialog.role')}</Label>
            <Select value={coachingRole} onValueChange={(v) => setCoachingRole(v as CoachingRole)}>
              <SelectTrigger>
                <SelectValue placeholder={t('coaches.createDialog.rolePlaceholder')}>
                  {(value: string | null) => value ? t(`coaches.coachingRole.${value}`) : null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {ALL_ROLES.map((r) => <SelectItem key={r} value={r}>{t(`coaches.coachingRole.${r}`)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t('coaches.createDialog.nationality')}</Label>
            <Input placeholder={t('coaches.createDialog.nationalityPlaceholder')} value={nationality} onChange={(e) => setNationality(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t('coaches.createDialog.notes')}</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>{t('coaches.createDialog.cancel')}</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? t('coaches.createDialog.saving') : t('coaches.createDialog.submit')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function CoachListPage() {
  const { t } = useTranslation('contract')
  const { user } = useCurrentUser()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const roundId = searchParams.get('roundId') ? Number(searchParams.get('roundId')) : undefined

  const [coaches, setCoaches] = useState<Coach[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<CoachStatus | 'ALL'>('ALL')
  const [createOpen, setCreateOpen] = useState(false)

  const canWrite =
    user?.role === 'GM' || (user?.role === 'FRONT_OFFICE' && user.frontOfficeRole === 'TD')
  const isGM = user?.role === 'GM'
  const canRead =
    user?.role === 'ADMIN' ||
    user?.role === 'GM' ||
    (user?.role === 'FRONT_OFFICE' && user.frontOfficeRole === 'TD')

  const fetchCoaches = () => {
    setLoading(true)
    coachApi.list({
      ...(roundId !== undefined && { roundId }),
      ...(statusFilter !== 'ALL' && { status: statusFilter }),
    })
      .then(setCoaches)
      .catch(() => toast.error(t('coaches.loadFailed')))
      .finally(() => setLoading(false))
  }

  useEffect(() => { void fetchCoaches() }, [roundId, statusFilter])

  const handleTransition = async (coach: Coach, status: CoachStatus) => {
    try {
      const shortlistSource = status === 'SHORTLISTED' ? 'MANUAL' as const : undefined
      await coachApi.updateStatus(coach.id, status, shortlistSource)
      toast.success(t('coaches.statusChangedTo', { status: t(`coaches.status.${status}`) }))
      void fetchCoaches()
    } catch (err: unknown) {
      const code = err instanceof Error ? err.message : ''
      const msg =
        code === 'COACHING_ROLE_ALREADY_FILLED' ? t('coaches.roleAlreadyFilled', { role: t(`coaches.coachingRole.${coach.coachingRole}`) }) :
        code || t('coaches.statusChangeFailed')
      toast.error(msg)
    }
  }

  const renderActions = (coach: Coach) => {
    if (!canWrite && !isGM) return null
    switch (coach.status) {
      case 'CANDIDATE':
        return canWrite ? (
          <div className="flex gap-1">
            <Button size="sm" variant="outline" className="h-7 text-xs"
              onClick={(e) => { e.stopPropagation(); void handleTransition(coach, 'SHORTLISTED') }}>
              {t('coaches.actionShortlist')}
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground"
              onClick={(e) => { e.stopPropagation(); void handleTransition(coach, 'ARCHIVED') }}>
              {t('coaches.actionArchive')}
            </Button>
          </div>
        ) : null
      case 'SHORTLISTED':
        return canWrite ? (
          <div className="flex gap-1">
            <Button size="sm" variant="outline" className="h-7 text-xs"
              onClick={(e) => { e.stopPropagation(); void handleTransition(coach, 'APPROVAL_PENDING') }}>
              {t('coaches.actionRequestApproval')}
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground"
              onClick={(e) => { e.stopPropagation(); void handleTransition(coach, 'ARCHIVED') }}>
              {t('coaches.actionArchive')}
            </Button>
          </div>
        ) : null
      case 'APPROVAL_PENDING':
        return (
          <div className="flex gap-1">
            {isGM && (
              <Button size="sm" className="h-7 text-xs"
                onClick={(e) => { e.stopPropagation(); void handleTransition(coach, 'CONTRACTED') }}>
                {t('coaches.actionFinalApprove')}
              </Button>
            )}
            {canWrite && (
              <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground"
                onClick={(e) => { e.stopPropagation(); void handleTransition(coach, 'ARCHIVED') }}>
                {t('coaches.actionArchive')}
              </Button>
            )}
          </div>
        )
      default:
        return null
    }
  }

  if (!canRead) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
        {t('coaches.noAccess')}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => navigate('/coaches/rounds')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">{t('coaches.title')}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {roundId ? t('coaches.round', { id: roundId }) : t('coaches.allCandidates')}
            </p>
          </div>
        </div>
        {canWrite && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />{t('coaches.addBtn')}
          </Button>
        )}
      </div>

      <div className="border-b px-6 py-3 flex items-center gap-3 shrink-0 bg-muted/30">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as CoachStatus | 'ALL')}>
          <SelectTrigger className="w-36 h-8 text-sm bg-background">
            <SelectValue>
              {(value: string | null) => value === 'ALL' ? t('coaches.statusAll') : value ? t(`coaches.status.${value}`) : null}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {ALL_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{s === 'ALL' ? t('coaches.statusAll') : t(`coaches.status.${s}`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : coaches.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
            {t('coaches.noData')}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>{t('coaches.col.name')}</TableHead>
                <TableHead className="w-28">{t('coaches.col.role')}</TableHead>
                <TableHead className="w-20">{t('coaches.col.nationality')}</TableHead>
                <TableHead className="w-28">{t('coaches.col.status')}</TableHead>
                <TableHead className="w-32">{t('coaches.col.shortlistSource')}</TableHead>
                <TableHead className="w-28 text-muted-foreground">{t('coaches.col.createdAt')}</TableHead>
                {(canWrite || isGM) && <TableHead className="w-44" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {coaches.map((c) => (
                <TableRow
                  key={c.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/coaches/${c.id}`)}
                >
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-sm">{t(`coaches.coachingRole.${c.coachingRole}`)}</TableCell>
                  <TableCell className="text-sm">{c.nationality ?? '—'}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs ${COACH_STATUS_STYLE[c.status]}`}>
                      {t(`coaches.status.${c.status}`)}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {c.shortlistSource ? t(`coaches.shortlistSource.${c.shortlistSource}`) : '—'}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground tabular-nums">
                    {formatDate(c.createdAt)}
                  </TableCell>
                  {(canWrite || isGM) && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {renderActions(c)}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <CreateCoachDialog
        roundId={roundId}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={() => { setCreateOpen(false); fetchCoaches() }}
      />
    </div>
  )
}
