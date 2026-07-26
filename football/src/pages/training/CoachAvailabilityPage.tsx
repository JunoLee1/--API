import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation('training')
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
      .catch(() => toast.error(t('availabilityPage.loadFailed')))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchItems() }, [])

  const handleCreate = async () => {
    if (!form.startDate || !form.endDate) {
      toast.error(t('availabilityPage.createDialog.required'))
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
      toast.success(t('availabilityPage.createDialog.saved'))
      setDialogOpen(false)
      setForm({ startDate: '', endDate: '', reason: '' })
      fetchItems()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('availabilityPage.createDialog.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await coachAvailabilityApi.delete(id)
      toast.success(t('availabilityPage.createDialog.deleted'))
      setItems((prev) => prev.filter((i) => i.id !== id))
    } catch {
      toast.error(t('availabilityPage.createDialog.deleteFailed'))
    }
  }

  const totalPages = Math.ceil(items.length / PAGE_SIZE)
  const paged = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">{t('availabilityPage.title')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('availabilityPage.description')}</p>
        </div>
        {canCreate && (
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />{t('availabilityPage.addBlock')}
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
            {t('availabilityPage.noBlocks')}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>{t('availabilityPage.coachCol')}</TableHead>
                <TableHead>{t('availabilityPage.roleCol')}</TableHead>
                <TableHead>{t('availabilityPage.startDateCol')}</TableHead>
                <TableHead>{t('availabilityPage.endDateCol')}</TableHead>
                <TableHead>{t('availabilityPage.reasonCol')}</TableHead>
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
          <DialogHeader><DialogTitle>{t('availabilityPage.createDialog.title')}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>{t('availabilityPage.createDialog.startDateLabel')} *</Label>
              <Input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('availabilityPage.createDialog.endDateLabel')} *</Label>
              <Input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('availabilityPage.createDialog.reasonLabel')}</Label>
              <Textarea
                rows={2}
                placeholder={t('availabilityPage.createDialog.reasonPlaceholder')}
                value={form.reason}
                onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              {t('availabilityPage.createDialog.cancel')}
            </Button>
            <Button onClick={() => void handleCreate()} disabled={saving}>
              {saving ? t('availabilityPage.createDialog.saving') : t('availabilityPage.createDialog.submit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
