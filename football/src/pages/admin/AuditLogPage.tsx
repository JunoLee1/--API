import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { auditLogApi } from '@/services/admin.service'
import type { AuditLogEntry, AuditLogFilters } from '@/types/auditLog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Pagination } from '@/components/ui/pagination'

const PAGE_SIZE = 50

function formatDate(d: string) {
  return new Date(d).toLocaleString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

export function AuditLogPage() {
  const { t } = useTranslation('admin')
  const [filters, setFilters] = useState<AuditLogFilters>({
    from: '', to: '', action: '', page: 1, limit: PAGE_SIZE,
  })
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  const fetchLogs = useCallback(async (f: AuditLogFilters) => {
    setLoading(true)
    try {
      const res = await auditLogApi.list(f)
      setLogs(res.logs)
      setTotal(res.total)
    } catch {
      toast.error(t('auditLogPage.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => { void fetchLogs(filters) }, [])

  const handleSearch = () => void fetchLogs({ ...filters, page: 1 })

  const handlePageChange = (page: number) => {
    const next = { ...filters, page }
    setFilters(next)
    void fetchLogs(next)
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 shrink-0">
        <h1 className="text-lg font-semibold tracking-tight">{t('auditLogPage.title')}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{t('auditLogPage.total', { count: total })}</p>
      </div>

      <div className="border-b px-6 py-3 flex flex-wrap gap-4 items-end shrink-0 bg-muted/30">
        <div className="space-y-1">
          <Label className="text-xs">{t('auditLogPage.startDateLabel')}</Label>
          <Input
            type="date"
            value={filters.from ?? ''}
            onChange={e => setFilters(f => ({ ...f, from: e.target.value }))}
            className="w-36 h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t('auditLogPage.endDateLabel')}</Label>
          <Input
            type="date"
            value={filters.to ?? ''}
            onChange={e => setFilters(f => ({ ...f, to: e.target.value }))}
            className="w-36 h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t('auditLogPage.actionLabel')}</Label>
          <Input
            placeholder={t('auditLogPage.actionPlaceholder')}
            value={filters.action ?? ''}
            onChange={e => setFilters(f => ({ ...f, action: e.target.value }))}
            className="w-40 h-8 text-sm"
          />
        </div>
        <Button size="sm" onClick={handleSearch} disabled={loading} className="h-8">
          {loading ? t('auditLogPage.searching') : t('auditLogPage.searchButton')}
        </Button>
      </div>

      <div className="flex-1 overflow-auto min-h-0">
        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-44">{t('auditLogPage.table.timestamp')}</TableHead>
                <TableHead className="w-40">{t('auditLogPage.table.action')}</TableHead>
                <TableHead>{t('auditLogPage.table.actor')}</TableHead>
                <TableHead className="w-32">{t('auditLogPage.table.targetId')}</TableHead>
                <TableHead>{t('auditLogPage.table.detail')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    {t('auditLogPage.noLogs')}
                  </TableCell>
                </TableRow>
              ) : logs.map(log => (
                <TableRow key={log.id}>
                  <TableCell className="tabular-nums text-xs">{formatDate(log.createdAt)}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-mono bg-muted">
                      {log.action}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">
                    {log.actor.nickname ?? log.actor.username}
                    <span className="ml-1 text-xs text-muted-foreground">({log.actor.role})</span>
                  </TableCell>
                  <TableCell className="tabular-nums text-sm text-muted-foreground">
                    {log.targetId ?? '—'}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-xs truncate font-mono">
                    {log.detail ?? '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Pagination
        page={filters.page ?? 1}
        totalPages={totalPages}
        totalItems={total}
        pageSize={PAGE_SIZE}
        onPageChange={handlePageChange}
      />
    </div>
  )
}
