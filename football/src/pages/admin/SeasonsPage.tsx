import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { seasonApi } from '@/services/season.service'
import type { Season, SeasonStatus, WageCapType } from '@/types/season'
import { SEASON_STATUS_LABEL, SEASON_STATUS_STYLE } from '@/types/season'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Pagination } from '@/components/ui/pagination'
import { Plus } from 'lucide-react'

const PAGE_SIZE = 10

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ko-KR')
}

function formatWageCap(s: Season): string {
  if (!s.wageCapType || s.wageCapValue == null) return '-'
  if (s.wageCapType === 'FIXED') return `고정 ${s.wageCapValue.toLocaleString()}원`
  return `수익 ${(s.wageCapValue * 100).toFixed(0)}%`
}

interface CreateSeasonDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSaved: () => void
}

function CreateSeasonDialog({ open, onOpenChange, onSaved }: CreateSeasonDialogProps) {
  const { t } = useTranslation('admin')
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim() || !startDate || !endDate) {
      toast.error(t('seasonsPage.createDialog.allRequired'))
      return
    }
    if (endDate <= startDate) {
      toast.error(t('seasonsPage.createDialog.endAfterStart'))
      return
    }
    setSaving(true)
    try {
      await seasonApi.create({ name: name.trim(), startDate, endDate })
      toast.success(t('seasonsPage.createDialog.createSuccess'))
      setName(''); setStartDate(''); setEndDate('')
      onSaved()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('seasonsPage.createDialog.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{t('seasonsPage.createDialog.title')}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>{t('seasonsPage.createDialog.nameLabel')}</Label>
            <Input placeholder={t('seasonsPage.createDialog.namePlaceholder')} value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t('seasonsPage.createDialog.startDateLabel')}</Label>
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t('seasonsPage.createDialog.endDateLabel')}</Label>
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>{t('seasonsPage.createDialog.cancel')}</Button>
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? t('seasonsPage.createDialog.saving') : t('seasonsPage.createDialog.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface WageCapConfigDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  season: Season
  onSaved: () => void
}

function WageCapConfigDialog({ open, onOpenChange, season, onSaved }: WageCapConfigDialogProps) {
  const { t } = useTranslation('admin')
  const [capType, setCapType] = useState<WageCapType | 'NONE'>(season.wageCapType ?? 'NONE')
  const [capValue, setCapValue] = useState(season.wageCapValue?.toString() ?? '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const wageCapType = capType === 'NONE' ? null : capType
      const wageCapValue = capType === 'NONE' ? null : Number(capValue)
      if (wageCapType !== null && (!capValue || isNaN(wageCapValue!))) {
        toast.error(t('seasonsPage.wageCapDialog.valueRequired'))
        setSaving(false)
        return
      }
      await seasonApi.setWageCap(season.id, { wageCapType, wageCapValue })
      toast.success(t('seasonsPage.wageCapDialog.saved'))
      onSaved()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('seasonsPage.wageCapDialog.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('seasonsPage.wageCapDialog.title', { name: season.name })}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>{t('seasonsPage.wageCapDialog.type')}</Label>
            <Select value={capType} onValueChange={(v) => setCapType(v as WageCapType | 'NONE')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">{t('seasonsPage.wageCapDialog.typeNone')}</SelectItem>
                <SelectItem value="FIXED">{t('seasonsPage.wageCapDialog.typeFixed')}</SelectItem>
                <SelectItem value="RATIO">{t('seasonsPage.wageCapDialog.typeRatio')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {capType !== 'NONE' && (
            <div className="space-y-1.5">
              <Label>
                {capType === 'FIXED'
                  ? t('seasonsPage.wageCapDialog.valueFixed')
                  : t('seasonsPage.wageCapDialog.valueRatio')}
              </Label>
              {capType === 'RATIO' ? (
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  max={1}
                  value={capValue}
                  onChange={e => setCapValue(e.target.value)}
                  placeholder="0.5"
                />
              ) : (
                <Input
                  type="text"
                  inputMode="numeric"
                  min={0}
                  value={capValue ? Number(capValue).toLocaleString('ko-KR') : ''}
                  onChange={e => setCapValue(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="1,000,000,000"
                />
              )}
              {capType === 'RATIO' && (
                <p className="text-xs text-muted-foreground">{t('seasonsPage.wageCapDialog.ratioHint')}</p>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>{t('seasonsPage.wageCapDialog.cancel')}</Button>
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? t('seasonsPage.wageCapDialog.saving') : t('seasonsPage.wageCapDialog.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function SeasonsPage() {
  const { t } = useTranslation('admin')
  const { user } = useCurrentUser()
  const [seasons, setSeasons] = useState<Season[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [wageCapTarget, setWageCapTarget] = useState<Season | null>(null)
  const [page, setPage] = useState(1)

  const isAdmin = user?.role === 'ADMIN'

  const fetchSeasons = () => {
    setLoading(true)
    setPage(1)
    seasonApi
      .list()
      .then(setSeasons)
      .catch(() => toast.error(t('seasonsPage.loadFailed')))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchSeasons() }, [])

  const handleActivate = async (id: number) => {
    try {
      await seasonApi.activate(id)
      toast.success(t('seasonsPage.activateSuccess'))
      fetchSeasons()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('seasonsPage.activateFailed'))
    }
  }

  const handleClose = async (id: number) => {
    try {
      await seasonApi.close(id)
      toast.success(t('seasonsPage.closeSuccess'))
      fetchSeasons()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('seasonsPage.closeFailed'))
    }
  }

  const totalPages = Math.ceil(seasons.length / PAGE_SIZE)
  const paged = seasons.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">{t('seasonsPage.title')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('seasonsPage.description', { count: seasons.length })}</p>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />{t('seasonsPage.addSeason')}
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
            {t('seasonsPage.loading')}
          </div>
        ) : seasons.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
            {t('seasonsPage.noSeasons')}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>{t('seasonsPage.table.name')}</TableHead>
                <TableHead className="w-28">{t('seasonsPage.table.startDate')}</TableHead>
                <TableHead className="w-28">{t('seasonsPage.table.endDate')}</TableHead>
                <TableHead className="w-24">{t('seasonsPage.table.status')}</TableHead>
                <TableHead className="w-36">{t('seasonsPage.table.wageCap')}</TableHead>
                {isAdmin && <TableHead className="w-48" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map(s => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="tabular-nums">{formatDate(s.startDate)}</TableCell>
                  <TableCell className="tabular-nums">{formatDate(s.endDate)}</TableCell>
                  <TableCell>
                    <span className={`inline-flex rounded border px-1.5 py-0.5 text-xs ${SEASON_STATUS_STYLE[s.status as SeasonStatus]}`}>
                      {SEASON_STATUS_LABEL[s.status as SeasonStatus]}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatWageCap(s)}</TableCell>
                  {isAdmin && (
                    <TableCell className="text-right space-x-1">
                      <Button
                        size="sm" variant="ghost" className="h-7 text-xs"
                        onClick={() => setWageCapTarget(s)}
                      >
                        {t('seasonsPage.setWageCap')}
                      </Button>
                      {s.status === 'UPCOMING' && (
                        <Button
                          size="sm" variant="outline" className="h-7 text-xs"
                          onClick={() => void handleActivate(s.id)}
                        >
                          {t('seasonsPage.activate')}
                        </Button>
                      )}
                      {s.status === 'ACTIVE' && (
                        <Button
                          size="sm" variant="outline" className="h-7 text-xs text-destructive"
                          onClick={() => void handleClose(s.id)}
                        >
                          {t('seasonsPage.close')}
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
        totalItems={seasons.length}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
      />

      <CreateSeasonDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={() => { setCreateOpen(false); fetchSeasons() }}
      />

      {wageCapTarget && (
        <WageCapConfigDialog
          open={!!wageCapTarget}
          onOpenChange={(v) => { if (!v) setWageCapTarget(null) }}
          season={wageCapTarget}
          onSaved={() => { setWageCapTarget(null); fetchSeasons() }}
        />
      )}
    </div>
  )
}
