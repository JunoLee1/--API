import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { coachAvailabilityApi } from '@/services/coach-availability.service'
import type { CoachAvailability } from '@/types/coach-availability'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Pagination } from '@/components/ui/pagination'
import { Plus, Trash2 } from 'lucide-react'

const PAGE_SIZE = 10

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ko-KR')
}

export function CoachAvailabilityPage() {
  const { user } = useCurrentUser()
  const [items, setItems] = useState<CoachAvailability[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [form, setForm] = useState({ startDate: '', endDate: '', reason: '' })
  const [saving, setSaving] = useState(false)

  const canCreate = user?.role === 'ADMIN' || user?.role === 'COACHING_STAFF'

  const fetchItems = () => {
    setLoading(true)
    coachAvailabilityApi
      .list()
      .then(setItems)
      .catch(() => toast.error('가용성 목록을 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchItems() }, [])

  const handleCreate = async () => {
    if (!form.startDate || !form.endDate) {
      toast.error('날짜를 모두 입력해주세요.')
      return
    }
    if (!user) return
    setSaving(true)
    try {
      const payload: Parameters<typeof coachAvailabilityApi.create>[0] = {
        userId: user.id,
        startDate: form.startDate,
        endDate: form.endDate,
      }
      if (form.reason.trim()) payload.reason = form.reason.trim()
      await coachAvailabilityApi.create(payload)
      toast.success('등록됐습니다.')
      setDialogOpen(false)
      setForm({ startDate: '', endDate: '', reason: '' })
      fetchItems()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '등록에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await coachAvailabilityApi.delete(id)
      toast.success('삭제됐습니다.')
      setItems((prev) => prev.filter((i) => i.id !== id))
    } catch {
      toast.error('삭제에 실패했습니다.')
    }
  }

  const totalPages = Math.ceil(items.length / PAGE_SIZE)
  const paged = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">코치 가용성</h1>
          <p className="text-sm text-muted-foreground mt-0.5">훈련 불가 일정 관리</p>
        </div>
        {canCreate && (
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />등록
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
            등록된 가용성 블록이 없습니다.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>코치</TableHead>
                <TableHead>역할</TableHead>
                <TableHead>시작일</TableHead>
                <TableHead>종료일</TableHead>
                <TableHead>사유</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.user.nickname ?? '—'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {item.user.coachingRole ?? '—'}
                  </TableCell>
                  <TableCell className="tabular-nums">{formatDate(item.startDate)}</TableCell>
                  <TableCell className="tabular-nums">{formatDate(item.endDate)}</TableCell>
                  <TableCell className="max-w-xs truncate text-muted-foreground">
                    {item.reason ?? '—'}
                  </TableCell>
                  <TableCell>
                    {(user?.role === 'ADMIN' || item.createdById === user?.id) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => void handleDelete(item.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Pagination
        page={page}
        totalPages={totalPages}
        totalItems={items.length}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>가용성 블록 등록</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>시작일 *</Label>
              <Input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>종료일 *</Label>
              <Input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>사유</Label>
              <Textarea
                rows={2}
                placeholder="사유 (선택)"
                value={form.reason}
                onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              취소
            </Button>
            <Button onClick={() => void handleCreate()} disabled={saving}>
              {saving ? '저장 중...' : '등록'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
