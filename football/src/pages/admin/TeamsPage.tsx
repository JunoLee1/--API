import { useEffect, useState } from 'react'
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
}

function TeamFormDialog({ open, onOpenChange, initial, onSaved }: TeamFormProps) {
  const isEdit = !!initial
  const [name, setName] = useState(initial?.name ?? '')
  const [type, setType] = useState<TeamType>(initial?.type ?? 'FIRST_TEAM')
  const [ageGroup, setAgeGroup] = useState(initial?.ageGroup ?? '')
  const [trackStats, setTrackStats] = useState(initial?.trackStats ?? true)
  const [requiresContract, setRequiresContract] = useState(initial?.requiresContract ?? true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (initial) {
      setName(initial.name)
      setType(initial.type)
      setAgeGroup(initial.ageGroup ?? '')
      setTrackStats(initial.trackStats)
      setRequiresContract(initial.requiresContract)
    }
  }, [initial])

  const handleSave = async () => {
    if (!name.trim()) { toast.error('팀명을 입력해주세요.'); return }
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
        toast.success('팀 정보가 수정됐습니다.')
      } else {
        await teamApi.create(payload)
        toast.success('팀이 등록됐습니다.')
      }
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
        <DialogHeader><DialogTitle>{isEdit ? '팀 수정' : '팀 등록'}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>팀명 *</Label>
            <Input
              placeholder="예: 1군 A팀"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>유형 *</Label>
            <Select
              value={type}
              onValueChange={v => setType(v as TeamType)}
              items={TEAM_TYPE_LABEL}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TEAM_TYPES.map(t => (
                  <SelectItem key={t} value={t}>{TEAM_TYPE_LABEL[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {type === 'YOUTH' && (
            <div className="space-y-1.5">
              <Label>연령 그룹</Label>
              <Input
                placeholder="예: U18, U15"
                value={ageGroup}
                onChange={e => setAgeGroup(e.target.value)}
              />
            </div>
          )}
          <div className="flex items-center justify-between">
            <Label htmlFor="track-stats">스탯 추적</Label>
            <Switch id="track-stats" checked={trackStats} onCheckedChange={setTrackStats} />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="req-contract">계약 필수</Label>
            <Switch id="req-contract" checked={requiresContract} onCheckedChange={setRequiresContract} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>취소</Button>
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? '저장 중...' : isEdit ? '수정' : '등록'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function TeamsPage() {
  const { user } = useCurrentUser()
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Team | null>(null)
  const [page, setPage] = useState(1)

  const isAdmin = user?.role === 'ADMIN'

  const fetchTeams = () => {
    setLoading(true)
    setPage(1)
    teamApi
      .list()
      .then(setTeams)
      .catch(() => toast.error('팀 목록을 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchTeams() }, [])

  const handleDeactivate = async (id: number) => {
    try {
      await teamApi.deactivate(id)
      toast.success('팀이 비활성화됐습니다.')
      fetchTeams()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '비활성화에 실패했습니다.')
    }
  }

  const totalPages = Math.ceil(teams.length / PAGE_SIZE)
  const paged = teams.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">팀 관리</h1>
          <p className="text-sm text-muted-foreground mt-0.5">전체 {teams.length}개 팀</p>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />팀 등록
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
            로딩 중...
          </div>
        ) : teams.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
            등록된 팀이 없습니다.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>팀명</TableHead>
                <TableHead className="w-20">유형</TableHead>
                <TableHead className="w-20">연령그룹</TableHead>
                <TableHead className="w-20 text-center">스탯추적</TableHead>
                <TableHead className="w-20 text-center">계약필수</TableHead>
                <TableHead className="w-20 text-center">상태</TableHead>
                {isAdmin && <TableHead className="w-32" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map(t => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell>{TEAM_TYPE_LABEL[t.type]}</TableCell>
                  <TableCell>{t.ageGroup ?? '—'}</TableCell>
                  <TableCell className="text-center">{t.trackStats ? '✓' : '—'}</TableCell>
                  <TableCell className="text-center">{t.requiresContract ? '✓' : '—'}</TableCell>
                  <TableCell className="text-center">
                    <span className={`inline-flex rounded border px-1.5 py-0.5 text-xs ${t.isActive ? 'border-green-300 text-green-700 bg-green-50' : 'border-gray-300 text-gray-500 bg-gray-50'}`}>
                      {t.isActive ? '활성' : '비활성'}
                    </span>
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-right space-x-1">
                      <Button
                        size="sm" variant="outline" className="h-7 text-xs"
                        onClick={() => setEditTarget(t)}
                      >
                        수정
                      </Button>
                      {t.isActive && (
                        <Button
                          size="sm" variant="outline" className="h-7 text-xs text-destructive"
                          onClick={() => void handleDeactivate(t.id)}
                        >
                          비활성화
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
      />
      <TeamFormDialog
        open={!!editTarget}
        onOpenChange={open => { if (!open) setEditTarget(null) }}
        initial={editTarget ?? undefined}
        onSaved={() => { setEditTarget(null); fetchTeams() }}
      />
    </div>
  )
}
