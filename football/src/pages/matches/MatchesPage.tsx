import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { matchApi } from '@/services/match.service'
import { seasonApi } from '@/services/season.service'
import type { Match, CompetitionType } from '@/types/match'
import { COMPETITION_STYLE } from '@/types/match'
import type { Season } from '@/types/season'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
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

const COMP_TYPES: CompetitionType[] = ['LEAGUE', 'DOMESTIC_CUP', 'CONTINENTAL', 'PLAYOFF', 'FRIENDLY']

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

interface CreateMatchDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  seasons: Season[]
  activeSeason: Season | null
  onSaved: () => void
  friendlyOnly?: boolean
}

function CreateMatchDialog({ open, onOpenChange, seasons, activeSeason, onSaved, friendlyOnly = false }: CreateMatchDialogProps) {
  const { t } = useTranslation('match')
  const [date, setDate] = useState('')
  const [home, setHome] = useState('')
  const [away, setAway] = useState('')
  const [competitionType, setCompetitionType] = useState<CompetitionType>(friendlyOnly ? 'FRIENDLY' : 'LEAGUE')
  const [seasonId, setSeasonId] = useState<string>(activeSeason ? String(activeSeason.id) : '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!date || !home.trim() || !away.trim() || !seasonId) {
      toast.error(t('register.required'))
      return
    }
    setSaving(true)
    try {
      await matchApi.create({ date, homeTeamName: home.trim(), awayTeamName: away.trim(), competitionType, seasonId: Number(seasonId) })
      toast.success(t('register.success'))
      onSaved()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('register.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{t('register.dialogTitle')}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>{t('register.dateLabel')} *</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>{t('register.homeTeam')} *</Label>
              <Input placeholder={t('register.homeTeamPlaceholder')} value={home} onChange={(e) => setHome(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('register.awayTeam')} *</Label>
              <Input placeholder={t('register.awayTeamPlaceholder')} value={away} onChange={(e) => setAway(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t('register.competitionLabel')} *</Label>
            {friendlyOnly ? (
              <div className="flex h-9 items-center rounded-md border bg-muted/50 px-3 text-sm text-muted-foreground">
                {t('competitionType.FRIENDLY')}
              </div>
            ) : (
              <Select value={competitionType} onValueChange={(v) => setCompetitionType(v as CompetitionType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COMP_TYPES.map((ct) => <SelectItem key={ct} value={ct}>{t(`competitionType.${ct}`)}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>{t('register.seasonLabel')} *</Label>
            <Select value={seasonId} onValueChange={(v) => { if (v) setSeasonId(v) }}>
              <SelectTrigger><SelectValue placeholder={t('register.seasonPlaceholder')} /></SelectTrigger>
              <SelectContent>
                {seasons.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>{t('common:action.cancel')}</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? t('register.saving') : t('register.registerBtn')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function MatchesPage() {
  const { t } = useTranslation('match')
  const navigate = useNavigate()
  const { user } = useCurrentUser()
  const [matches, setMatches] = useState<Match[]>([])
  const [seasons, setSeasons] = useState<Season[]>([])
  const [activeSeason, setActiveSeason] = useState<Season | null>(null)
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('ALL')
  const [compFilter, setCompFilter] = useState<CompetitionType | 'ALL'>('ALL')
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)

  const canCreateFriendly = user?.role === 'FRONT_OFFICE' || user?.role === 'COACHING_STAFF'

  const seasonFilterItems = useMemo(() => {
    const map: Record<string, string> = { ALL: t('seasonAll') }
    seasons.forEach((s) => { map[String(s.id)] = s.name })
    return map
  }, [seasons, t])

  const compFilterItems = useMemo(() => ({
    ALL: t('competitionAll'),
    ...Object.fromEntries(COMP_TYPES.map((ct) => [ct, t(`competitionType.${ct}`)])),
  }), [t])

  useEffect(() => {
    seasonApi.list().then((list) => {
      setSeasons(list)
      const active = list.find((s) => s.status === 'ACTIVE') ?? null
      setActiveSeason(active)
      if (active) setSelectedSeasonId(String(active.id))
    }).catch(() => null)
  }, [])

  const fetchMatches = () => {
    setLoading(true)
    matchApi.list({
      seasonId: selectedSeasonId !== 'ALL' ? Number(selectedSeasonId) : undefined,
      competitionType: compFilter !== 'ALL' ? compFilter : undefined,
    })
      .then(setMatches)
      .catch(() => toast.error(t('errors.loadFailed', t('register.saveFailed'))))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchMatches() }, [selectedSeasonId, compFilter])

  const scoreDisplay = (m: Match) => {
    if (m.homeScore == null || m.awayScore == null) return <span className="text-muted-foreground text-xs">{t('tbd')}</span>
    return <span className="font-mono font-semibold tabular-nums">{m.homeScore} : {m.awayScore}</span>
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 flex items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">{t('list')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('totalCount', { count: matches.length })}</p>
        </div>
        {canCreateFriendly && (
          <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />{t('addFriendly')}
          </Button>
        )}
      </div>

      <div className="border-b px-6 py-3 flex items-center gap-3 shrink-0 bg-muted/30">
        <Select value={selectedSeasonId} onValueChange={(v) => { if (v) setSelectedSeasonId(v) }} items={seasonFilterItems}>
          <SelectTrigger className="w-36 h-8 text-sm bg-background"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t('seasonAll')}</SelectItem>
            {seasons.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={compFilter} onValueChange={(v) => setCompFilter(v as CompetitionType | 'ALL')} items={compFilterItems}>
          <SelectTrigger className="w-32 h-8 text-sm bg-background"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t('competitionAll')}</SelectItem>
            {COMP_TYPES.map((ct) => <SelectItem key={ct} value={ct}>{t(`competitionType.${ct}`)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-6 space-y-3">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : matches.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">{t('noMatches')}</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-24">{t('tableHeader.date')}</TableHead>
                <TableHead className="w-24">{t('tableHeader.competition')}</TableHead>
                <TableHead>{t('tableHeader.home')}</TableHead>
                <TableHead className="w-20 text-center">{t('tableHeader.score')}</TableHead>
                <TableHead>{t('tableHeader.away')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {matches.map((m) => (
                <TableRow key={m.id} className="cursor-pointer" onClick={() => navigate(`/matches/${m.id}`)}>
                  <TableCell className="tabular-nums text-muted-foreground">{formatDate(m.date)}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs ${COMPETITION_STYLE[m.competitionType]}`}>
                      {t(`competitionType.${m.competitionType}`)}
                    </span>
                  </TableCell>
                  <TableCell className="font-medium">{m.homeTeamName}</TableCell>
                  <TableCell className="text-center">{scoreDisplay(m)}</TableCell>
                  <TableCell>{m.awayTeamName}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <CreateMatchDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        seasons={seasons}
        activeSeason={activeSeason}
        onSaved={() => { setCreateOpen(false); fetchMatches() }}
        friendlyOnly={canCreateFriendly}
      />
    </div>
  )
}
