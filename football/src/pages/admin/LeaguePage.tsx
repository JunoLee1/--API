import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { leagueApi } from '@/services/league.service'
import { clubApi } from '@/services/club.service'
import type { League, LeagueLevel } from '@/types/league'
import { LEAGUE_LEVEL_LABEL, LEAGUE_LEVELS } from '@/types/league'
import type { Club } from '@/types/team'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Plus, X } from 'lucide-react'

interface CreateLeagueDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSaved: () => void
}

function CreateLeagueDialog({ open, onOpenChange, onSaved }: CreateLeagueDialogProps) {
  const [name, setName] = useState('')
  const [level, setLevel] = useState<LeagueLevel | ''>('')
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim() || !level || !year) {
      toast.error('모든 항목을 입력해 주세요.')
      return
    }
    const parsedYear = Number(year)
    if (!Number.isInteger(parsedYear) || parsedYear < 2000 || parsedYear > 2100) {
      toast.error('유효한 연도를 입력해 주세요. (2000–2100)')
      return
    }
    setSaving(true)
    try {
      await leagueApi.create({ name: name.trim(), level, year: parsedYear })
      toast.success('리그가 생성되었습니다.')
      onSaved()
      onOpenChange(false)
      setName('')
      setLevel('')
      setYear(String(new Date().getFullYear()))
    } catch (err: any) {
      const code = err?.response?.data?.code
      if (code === 'LEAGUE_ALREADY_EXISTS') toast.error('동일한 레벨과 연도의 리그가 이미 존재합니다.')
      else toast.error('리그 생성에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>리그 생성</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>리그명</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: K리그1 2026"
            />
          </div>
          <div className="space-y-1.5">
            <Label>레벨</Label>
            <Select value={level} onValueChange={(v) => setLevel(v as LeagueLevel)}>
              <SelectTrigger>
                <SelectValue placeholder="레벨 선택" />
              </SelectTrigger>
              <SelectContent>
                {LEAGUE_LEVELS.map((l) => (
                  <SelectItem key={l} value={l}>{LEAGUE_LEVEL_LABEL[l]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>연도</Label>
            <Input
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              min={2000}
              max={2100}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? '저장 중...' : '생성'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface LeagueDetailPanelProps {
  league: League
  allClubs: Club[]
  onUpdated: (updated: League) => void
}

function LeagueDetailPanel({ league, allClubs, onUpdated }: LeagueDetailPanelProps) {
  const [selectedClubId, setSelectedClubId] = useState<string>('')
  const [adding, setAdding] = useState(false)
  const [removing, setRemoving] = useState<number | null>(null)
  const [toggling, setToggling] = useState(false)

  const registeredIds = new Set(league.clubs.map((c) => c.clubId))
  const availableClubs = allClubs.filter((c) => !registeredIds.has(c.id))

  const handleAddClub = async () => {
    if (!selectedClubId) return
    setAdding(true)
    try {
      const updated = await leagueApi.registerClub(league.id, Number(selectedClubId))
      onUpdated(updated)
      setSelectedClubId('')
      toast.success('구단이 등록되었습니다.')
    } catch (err: any) {
      const code = err?.response?.data?.code
      if (code === 'CLUB_ALREADY_IN_LEAGUE') toast.error('이미 이 리그에 등록된 구단입니다.')
      else if (code === 'CLUB_NOT_FOUND') toast.error('구단을 찾을 수 없습니다.')
      else toast.error('구단 등록에 실패했습니다.')
    } finally {
      setAdding(false)
    }
  }

  const handleRemoveClub = async (clubId: number) => {
    setRemoving(clubId)
    try {
      const updated = await leagueApi.removeClub(league.id, clubId)
      onUpdated(updated)
      toast.success('구단이 제거되었습니다.')
    } catch {
      toast.error('구단 제거에 실패했습니다.')
    } finally {
      setRemoving(null)
    }
  }

  const handleToggleActive = async () => {
    setToggling(true)
    try {
      const updated = await leagueApi.update(league.id, { isActive: !league.isActive })
      onUpdated(updated)
      toast.success(updated.isActive ? '리그가 활성화되었습니다.' : '리그가 비활성화되었습니다.')
    } catch {
      toast.error('상태 변경에 실패했습니다.')
    } finally {
      setToggling(false)
    }
  }

  return (
    <div className="border rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-base">{league.name}</h3>
          <p className="text-sm text-muted-foreground">
            {LEAGUE_LEVEL_LABEL[league.level]} · {league.year}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleToggleActive}
          disabled={toggling}
        >
          {league.isActive ? '비활성화' : '활성화'}
        </Button>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">참가 구단 ({league.clubs.length})</p>
        {league.clubs.length === 0 && (
          <p className="text-sm text-muted-foreground">등록된 구단이 없습니다.</p>
        )}
        <div className="space-y-1">
          {league.clubs.map((lc) => (
            <div key={lc.clubId} className="flex items-center justify-between py-1 px-2 rounded hover:bg-muted/50">
              <span className="text-sm">{lc.club.name}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                disabled={removing === lc.clubId}
                onClick={() => handleRemoveClub(lc.clubId)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      {availableClubs.length > 0 && (
        <div className="flex gap-2">
          <Select value={selectedClubId} onValueChange={(v) => setSelectedClubId(v ?? '')}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="구단 선택" />
            </SelectTrigger>
            <SelectContent>
              {availableClubs.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={handleAddClub} disabled={adding || !selectedClubId}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}

export function LeaguePage() {
  const { user } = useCurrentUser()
  const { i18n } = useTranslation()
  const [leagues, setLeagues] = useState<League[]>([])
  const [allClubs, setAllClubs] = useState<Club[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedLeague, setSelectedLeague] = useState<League | null>(null)

  const isSuperAdmin = user?.role === 'SUPER_ADMIN'

  const levelLabel = (level: LeagueLevel) =>
    i18n.language === 'en'
      ? { K3: 'K3', K_LEAGUE_2: 'K League 2', K_LEAGUE_1: 'K League 1', EPL: 'EPL', OTHER: 'Other' }[level]
      : LEAGUE_LEVEL_LABEL[level]

  const load = async () => {
    setLoading(true)
    try {
      const [ls, cs] = await Promise.all([leagueApi.list(), clubApi.list()])
      setLeagues(ls)
      setAllClubs(cs)
    } catch {
      toast.error('데이터 로드에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const handleLeagueUpdated = (updated: League) => {
    setLeagues((prev) => prev.map((l) => (l.id === updated.id ? updated : l)))
    setSelectedLeague(updated)
  }

  if (!isSuperAdmin) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">접근 권한이 없습니다.</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">리그 관리</h1>
          <p className="text-sm text-muted-foreground mt-0.5">리그를 생성하고 참가 구단을 관리합니다.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          리그 생성
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-3">
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>리그명</TableHead>
                  <TableHead>레벨</TableHead>
                  <TableHead>연도</TableHead>
                  <TableHead>구단 수</TableHead>
                  <TableHead>상태</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      로딩 중...
                    </TableCell>
                  </TableRow>
                )}
                {!loading && leagues.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      등록된 리그가 없습니다.
                    </TableCell>
                  </TableRow>
                )}
                {leagues.map((league) => (
                  <TableRow
                    key={league.id}
                    className={`cursor-pointer ${selectedLeague?.id === league.id ? 'bg-accent' : ''}`}
                    onClick={() => setSelectedLeague(league.id === selectedLeague?.id ? null : league)}
                  >
                    <TableCell className="font-medium">{league.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{levelLabel(league.level)}</Badge>
                    </TableCell>
                    <TableCell>{league.year}</TableCell>
                    <TableCell>{league.clubs.length}</TableCell>
                    <TableCell>
                      <Badge variant={league.isActive ? 'default' : 'secondary'}>
                        {league.isActive ? '활성' : '비활성'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        <div>
          {selectedLeague ? (
            <LeagueDetailPanel
              key={selectedLeague.id}
              league={selectedLeague}
              allClubs={allClubs}
              onUpdated={handleLeagueUpdated}
            />
          ) : (
            <div className="border rounded-lg p-8 text-center text-muted-foreground text-sm">
              리그를 선택하면 상세 정보와 참가 구단을 관리할 수 있습니다.
            </div>
          )}
        </div>
      </div>

      <CreateLeagueDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={load}
      />
    </div>
  )
}
