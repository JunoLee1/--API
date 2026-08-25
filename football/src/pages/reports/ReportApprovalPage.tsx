import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { reportApi } from '@/services/report.service'
import type { Report, ReportType } from '@/types/report'
import { REPORT_TYPE_LABEL, REPORT_TYPE_STYLE, REPORT_STATUS_LABEL, REPORT_STATUS_STYLE } from '@/types/report'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { CheckCircle2, XCircle } from 'lucide-react'

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('ko-KR')
}

// ---------------------------------------------------------------------------
// RejectDialog
// ---------------------------------------------------------------------------
function RejectDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onConfirm: (reason: string) => Promise<void>
}) {
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)

  const handleConfirm = async () => {
    if (!reason.trim()) { toast.error('반려 사유를 입력해주세요'); return }
    setLoading(true)
    try { await onConfirm(reason.trim()) } finally { setLoading(false) }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setReason(''); onOpenChange(v) }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>보고서 반려</DialogTitle></DialogHeader>
        <div className="space-y-1.5 py-2">
          <Textarea
            placeholder="반려 사유를 입력하세요. 작성자에게 전달됩니다."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>취소</Button>
          <Button variant="destructive" onClick={() => void handleConfirm()} disabled={loading}>
            {loading ? '처리 중...' : '반려 확정'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// ApprovalList
// ---------------------------------------------------------------------------
interface ApprovalListProps {
  filters: Array<{ type?: ReportType; status: string }>
  label: string
}

function ApprovalList({ filters, label }: ApprovalListProps) {
  const navigate = useNavigate()
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [actingId, setActingId] = useState<number | null>(null)
  const [rejectTargetId, setRejectTargetId] = useState<number | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const results = await Promise.all(
        filters.map(({ type, status }) => reportApi.list({ type, status }))
      )
      // Merge, deduplicate by id, sort newest first
      const seen = new Set<number>()
      const merged: Report[] = []
      for (const batch of results) {
        for (const r of batch) {
          if (!seen.has(r.id)) { seen.add(r.id); merged.push(r) }
        }
      }
      merged.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      setReports(merged)
    } catch {
      toast.error('목록을 불러오지 못했습니다')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleApprove = async (id: number) => {
    setActingId(id)
    try {
      await reportApi.approve(id)
      toast.success('승인됐습니다')
      void load()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '승인에 실패했습니다')
    } finally {
      setActingId(null)
    }
  }

  const handleReject = async (reason: string) => {
    if (!rejectTargetId) return
    try {
      await reportApi.reject(rejectTargetId, reason)
      toast.success('반려됐습니다')
      setRejectTargetId(null)
      void load()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '반려에 실패했습니다')
    }
  }

  if (loading) {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
      </div>
    )
  }

  if (reports.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
        {label}에 결재 대기 중인 보고서가 없습니다.
      </div>
    )
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>제목</TableHead>
            <TableHead>유형</TableHead>
            <TableHead>상태</TableHead>
            <TableHead>작성자</TableHead>
            <TableHead>부서</TableHead>
            <TableHead>작성일</TableHead>
            <TableHead className="w-40 text-right" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {reports.map((r) => {
            const acting = actingId === r.id
            return (
              <TableRow key={r.id} className="cursor-pointer" onClick={() => navigate(`/reports/${r.id}`)}>
                <TableCell className="text-sm font-medium max-w-xs truncate">{r.title}</TableCell>
                <TableCell>
                  <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs ${REPORT_TYPE_STYLE[r.type]}`}>
                    {REPORT_TYPE_LABEL[r.type]}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={`text-xs ${REPORT_STATUS_STYLE[r.status]}`}>
                    {REPORT_STATUS_LABEL[r.status]}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">{r.author.nickname}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{r.department?.name ?? '—'}</TableCell>
                <TableCell className="text-sm tabular-nums">{fmtDate(r.createdAt)}</TableCell>
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-end gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2"
                      disabled={acting}
                      onClick={() => void handleApprove(r.id)}
                    >
                      <CheckCircle2 className="h-3 w-3 mr-1" />승인
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-red-700 hover:bg-red-50 hover:text-red-800"
                      disabled={acting}
                      onClick={() => setRejectTargetId(r.id)}
                    >
                      <XCircle className="h-3 w-3 mr-1" />반려
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      <RejectDialog
        open={rejectTargetId !== null}
        onOpenChange={(v) => { if (!v) setRejectTargetId(null) }}
        onConfirm={handleReject}
      />
    </>
  )
}

// ---------------------------------------------------------------------------
// ReportApprovalPage
// ---------------------------------------------------------------------------
export function ReportApprovalPage() {
  const { user } = useCurrentUser()

  const isGM = user?.role === 'GM' || user?.role === 'ADMIN'
  const foRole = user?.frontOfficeRole
  const isHrManager = user?.role === 'FRONT_OFFICE' && foRole === 'HR_MANAGER'
  const isAssetManager = user?.role === 'FRONT_OFFICE' && foRole === 'ASSET_MANAGER'
  const isFinanceManager = user?.role === 'FRONT_OFFICE' && foRole === 'FINANCE_MANAGER'
  const isHeadCoach = user?.role === 'COACHING_STAFF' && user?.coachingRole === 'HEAD_COACH'

  // Tab 1 — 1차 결재 대기
  const firstStageFilters: Array<{ type?: ReportType; status: string }> = []
  if (isHrManager) firstStageFilters.push({ type: 'HR', status: 'SUBMITTED' })
  if (isAssetManager) firstStageFilters.push({ type: 'ASSET', status: 'SUBMITTED' })
  if (isFinanceManager) firstStageFilters.push({ type: 'FINANCIAL', status: 'SUBMITTED' })
  if (isHeadCoach) firstStageFilters.push({ type: 'TRAINING', status: 'SUBMITTED' })
  const showFirstStage = firstStageFilters.length > 0

  // Tab 2 — 2차 결재 대기 (ASSET_MANAGER only: HR reports at FIRST_APPROVED)
  const showSecondStage = isAssetManager

  // Tab 3 — 최종 결재 대기 (GM)
  const finalStageFilters: Array<{ type?: ReportType; status: string }> = []
  if (isGM) {
    finalStageFilters.push(
      { type: 'HR', status: 'SECOND_APPROVED' },
      { type: 'ASSET', status: 'FIRST_APPROVED' },
      { type: 'FINANCIAL', status: 'FIRST_APPROVED' },
      { type: 'PERFORMANCE', status: 'SUBMITTED' },
      { type: 'MEDICAL', status: 'SUBMITTED' },
    )
  }
  const showFinalStage = finalStageFilters.length > 0

  const hasAnyTab = showFirstStage || showSecondStage || showFinalStage

  const defaultTab = showFirstStage ? 'first' : showSecondStage ? 'second' : showFinalStage ? 'final' : 'first'

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 shrink-0">
        <h1 className="text-lg font-semibold tracking-tight">보고서 결재함</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          결재 권한이 있는 보고서만 표시됩니다.
        </p>
      </div>

      {!hasAnyTab ? (
        <div className="flex items-center justify-center flex-1 text-sm text-muted-foreground">
          결재 권한이 없습니다.
        </div>
      ) : (
        <div className="flex-1 overflow-auto p-6">
          <Tabs defaultValue={defaultTab}>
            <TabsList className="mb-4">
              {showFirstStage && <TabsTrigger value="first">1차 결재 대기</TabsTrigger>}
              {showSecondStage && <TabsTrigger value="second">2차 결재 대기</TabsTrigger>}
              {showFinalStage && <TabsTrigger value="final">최종 결재 대기</TabsTrigger>}
            </TabsList>

            {showFirstStage && (
              <TabsContent value="first">
                <ApprovalList filters={firstStageFilters} label="1차 결재" />
              </TabsContent>
            )}
            {showSecondStage && (
              <TabsContent value="second">
                <ApprovalList
                  filters={[{ type: 'HR', status: 'FIRST_APPROVED' }]}
                  label="2차 결재"
                />
              </TabsContent>
            )}
            {showFinalStage && (
              <TabsContent value="final">
                <ApprovalList filters={finalStageFilters} label="최종 결재" />
              </TabsContent>
            )}
          </Tabs>
        </div>
      )}
    </div>
  )
}
