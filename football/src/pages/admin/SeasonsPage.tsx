import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { seasonApi } from '@/services/season.service'
import type { Season, SeasonStatus } from '@/types/season'
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
import { Pagination } from '@/components/ui/pagination'
import { Plus } from 'lucide-react'

const PAGE_SIZE = 10

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ko-KR')
}

interface CreateSeasonDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSaved: () => void
}

function CreateSeasonDialog({ open, onOpenChange, onSaved }: CreateSeasonDialogProps) {
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim() || !startDate || !endDate) {
      toast.error('모든 항목을 입력해주세요.')
      return
    }
    if (endDate <= startDate) {
      toast.error('종료일은 시작일 이후여야 합니다.')
      return
    }
    setSaving(true)
    try {
      await seasonApi.create({ name: name.trim(), startDate, endDate })
      toast.success('시즌이 등록됐습니다.')
      setName(''); setStartDate(''); setEndDate('')
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
        <DialogHeader><DialogTitle>시즌 등록</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>시즌명 *</Label>
            <Input placeholder="예: 2026-27 시즌" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>시작일 *</Label>
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>종료일 *</Label>
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>취소</Button>
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? '저장 중...' : '등록'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function SeasonsPage() {
  const { user } = useCurrentUser()
  const [seasons, setSeasons] = useState<Season[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [page, setPage] = useState(1)

  const isAdmin = user?.role === 'ADMIN'

  const fetchSeasons = () => {
    setLoading(true)
    setPage(1)
    seasonApi
      .list()
      .then(setSeasons)
      .catch(() => toast.error('시즌 목록을 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchSeasons() }, [])

  const handleActivate = async (id: number) => {
    try {
      await seasonApi.activate(id)
      toast.success('시즌이 활성화됐습니다.')
      fetchSeasons()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '활성화에 실패했습니다.')
    }
  }

  const handleClose = async (id: number) => {
    try {
      await seasonApi.close(id)
      toast.success('시즌이 종료됐습니다.')
      fetchSeasons()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '종료에 실패했습니다.')
    }
  }

  const totalPages = Math.ceil(seasons.length / PAGE_SIZE)
  const paged = seasons.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">시즌 관리</h1>
          <p className="text-sm text-muted-foreground mt-0.5">전체 {seasons.length}개 시즌</p>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />시즌 등록
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
            로딩 중...
          </div>
        ) : seasons.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
            등록된 시즌이 없습니다.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>시즌명</TableHead>
                <TableHead className="w-28">시작일</TableHead>
                <TableHead className="w-28">종료일</TableHead>
                <TableHead className="w-24">상태</TableHead>
                {isAdmin && <TableHead className="w-32" />}
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
                  {isAdmin && (
                    <TableCell className="text-right space-x-1">
                      {s.status === 'UPCOMING' && (
                        <Button
                          size="sm" variant="outline" className="h-7 text-xs"
                          onClick={() => void handleActivate(s.id)}
                        >
                          활성화
                        </Button>
                      )}
                      {s.status === 'ACTIVE' && (
                        <Button
                          size="sm" variant="outline" className="h-7 text-xs text-destructive"
                          onClick={() => void handleClose(s.id)}
                        >
                          종료
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
    </div>
  )
}
