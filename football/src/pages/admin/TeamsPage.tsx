import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { teamApi, type CreateTeamPayload } from '@/services/team.service'
import type { Team, TeamType } from '@/types/team'
import { TEAM_TYPE_LABEL } from '@/types/team'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Pagination } from '@/components/ui/pagination'
import { Plus } from 'lucide-react'

const PAGE_SIZE = 10
const TEAM_TYPES: TeamType[] = ['FIRST_TEAM', 'YOUTH']

interface TeamFormProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  initial?: Team
  onSaved: () => void
  youthOnly?: boolean
}

function TeamFormDialog({ open, onOpenChange, initial, onSaved, youthOnly }: TeamFormProps) {
  const { t } = useTranslation('admin')
  const isEdit = !!initial
  const [name, setName] = useState(initial?.name ?? '')
  const [type, setType] = useState<TeamType>(youthOnly ? 'YOUTH' : (initial?.type ?? 'FIRST_TEAM'))
  const [ageGroup, setAgeGroup] = useState(initial?.ageGroup ?? '')
  const [trackStats, setTrackStats] = useState(initial?.trackStats ?? true)
  const [requiresContract, setRequiresContract] = useState(initial?.requiresContract ?? true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (initial) {
      setName(initial.name)
      setType(youthOnly ? 'YOUTH' : initial.type)
      setAgeGroup(initial.ageGroup ?? '')
      setTrackStats(initial.trackStats)
      setRequiresContract(initial.requiresContract)
    }
  }, [initial, youthOnly])

  const handleSave = async () => {
    if (!name.trim()) { toast.error(t('teamsPage.formDialog.nameRequired')); return }
    setSaving(true)
    const payload: CreateTeamPayload = {
      name: name.trim(),
      type,
      trackStats,
      requiresContract,
    }
    if (ageGroup.trim()) payload.ageGroup = ageGroup.trim()
    try {
      if (isEdit) {
        await teamApi.update(initial!.id, payload)
        toast.success(t('teamsPage.formDialog.editSuccess'))
      } else {
        await teamApi.create(payload)
        toast.success(t('teamsPage.formDialog.createSuccess'))
      }
      onSaved()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('teamsPage.formDialog.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{isEdit ? t('teamsPage.formDialog.editTitle') : t('teamsPage.formDialog.createTitle')}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>{t('teamsPage.formDialog.nameLabel')}</Label>
            <Input
              placeholder={t('teamsPage.formDialog.namePlaceholder')}
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t('teamsPage.formDialog.typeLabel')}</Label>
            {youthOnly ? (
              <div className="flex h-9 w-full items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">
                {TEAM_TYPE_LABEL['YOUTH']}
              </div>
            ) : (
              <Select
                value={type}
                onValueChange={v => setType(v as TeamType)}
                items={TEAM_TYPE_LABEL}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TEAM_TYPES.map(tp => (
                    <SelectItem key={tp} value={tp}>{TEAM_TYPE_LABEL[tp]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          {type === 'YOUTH' && (
            <div className="space-y-1.5">
              <Label>{t('teamsPage.formDialog.ageGroupLabel')}</Label>
              <Input
                placeholder={t('teamsPage.formDialog.ageGroupPlaceholder')}
                value={ageGroup}
                onChange={e => setAgeGroup(e.target.value)}
              />
            </div>
          )}
          <div className="flex items-center justify-between">
            <Label htmlFor="track-stats">{t('teamsPage.formDialog.trackStats')}</Label>
            <Switch id="track-stats" checked={trackStats} onCheckedChange={setTrackStats} />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="req-contract">{t('teamsPage.formDialog.requiresContract')}</Label>
            <Switch id="req-contract" checked={requiresContract} onCheckedChange={setRequiresContract} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>{t('teamsPage.formDialog.cancel')}</Button>
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? t('teamsPage.formDialog.saving') : isEdit ? t('teamsPage.formDialog.update') : t('teamsPage.formDialog.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function TeamsPage() {
  const { t } = useTranslation('admin')
  const { user } = useCurrentUser()
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Team | null>(null)
  const [page, setPage] = useState(1)

  const isSuperAdmin = user?.role === 'SUPER_ADMIN'
  const isAdminOrGM = user?.role === 'ADMIN' || user?.role === 'GM'
  const canWrite = isSuperAdmin || isAdminOrGM

  const fetchTeams = () => {
    setLoading(true)
    setPage(1)
    teamApi
      .list()
      .then(setTeams)
      .catch(() => toast.error(t('teamsPage.loadFailed')))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchTeams() }, [])

  const handleDeactivate = async (id: number) => {
    try {
      await teamApi.deactivate(id)
      toast.success(t('teamsPage.deactivateSuccess'))
      fetchTeams()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('teamsPage.deactivateFailed'))
    }
  }

  const totalPages = Math.ceil(teams.length / PAGE_SIZE)
  const paged = teams.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">{t('teamsPage.title')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('teamsPage.description', { count: teams.length })}</p>
        </div>
        {canWrite && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />{t('teamsPage.addTeam')}
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
            {t('teamsPage.loading')}
          </div>
        ) : teams.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
            {t('teamsPage.noTeams')}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>{t('teamsPage.table.name')}</TableHead>
                <TableHead className="w-20">{t('teamsPage.table.type')}</TableHead>
                <TableHead className="w-20">{t('teamsPage.table.ageGroup')}</TableHead>
                <TableHead className="w-20 text-center">{t('teamsPage.table.trackStats')}</TableHead>
                <TableHead className="w-20 text-center">{t('teamsPage.table.requiresContract')}</TableHead>
                <TableHead className="w-20 text-center">{t('teamsPage.table.status')}</TableHead>
                {canWrite && <TableHead className="w-32" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map(tp => (
                <TableRow key={tp.id}>
                  <TableCell className="font-medium">{tp.name}</TableCell>
                  <TableCell>{TEAM_TYPE_LABEL[tp.type]}</TableCell>
                  <TableCell>{tp.ageGroup ?? '—'}</TableCell>
                  <TableCell className="text-center">{tp.trackStats ? '✓' : '—'}</TableCell>
                  <TableCell className="text-center">{tp.requiresContract ? '✓' : '—'}</TableCell>
                  <TableCell className="text-center">
                    <span className={`inline-flex rounded border px-1.5 py-0.5 text-xs ${tp.isActive ? 'border-green-300 text-green-700 bg-green-50' : 'border-gray-300 text-gray-500 bg-gray-50'}`}>
                      {tp.isActive ? t('teamsPage.statusActive') : t('teamsPage.statusInactive')}
                    </span>
                  </TableCell>
                  {canWrite && (isSuperAdmin || tp.type === 'YOUTH') && (
                    <TableCell className="text-right space-x-1">
                      <Button
                        size="sm" variant="outline" className="h-7 text-xs"
                        onClick={() => setEditTarget(tp)}
                      >
                        {t('teamsPage.edit')}
                      </Button>
                      {tp.isActive && (
                        <Button
                          size="sm" variant="outline" className="h-7 text-xs text-destructive"
                          onClick={() => void handleDeactivate(tp.id)}
                        >
                          {t('teamsPage.deactivate')}
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

      <Pagination
        page={page}
        totalPages={totalPages}
        totalItems={teams.length}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
      />

      <TeamFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={() => { setCreateOpen(false); fetchTeams() }}
        youthOnly={isAdminOrGM}
      />
      <TeamFormDialog
        open={!!editTarget}
        onOpenChange={open => { if (!open) setEditTarget(null) }}
        initial={editTarget ?? undefined}
        onSaved={() => { setEditTarget(null); fetchTeams() }}
        youthOnly={isAdminOrGM}
      />
    </div>
  )
}
