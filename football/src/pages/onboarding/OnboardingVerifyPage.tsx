import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { onboardingTaskApi } from '@/services/onboarding-task.service'
import type { OnboardingVerifyQueueRow } from '@/types/onboarding-task'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { CheckCircle2, XCircle } from 'lucide-react'

/**
 * OnboardingVerifyPage
 *
 * Route: `/hr/onboarding-verify`
 *
 * Owned by HR + dept.head. Renders the SELF_REPORTED task queue and lets
 * the reviewer APPROVE or REJECT each item. REJECT requires notes (also
 * enforced service-side). Self-verify is blocked service-side — trainee
 * won't see their own tasks here.
 */
export default function OnboardingVerifyPage() {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<OnboardingVerifyQueueRow[]>([])
  const [reviewing, setReviewing] = useState<{
    task: OnboardingVerifyQueueRow
    action: 'APPROVE' | 'REJECT'
    notes: string
  } | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const q = await onboardingTaskApi.verifyQueue()
      setRows(q)
    } catch (err) {
      toast.error(`큐 로드 실패: ${err instanceof Error ? err.message : ''}`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const handleConfirm = async () => {
    if (!reviewing) return
    if (reviewing.action === 'REJECT' && !reviewing.notes.trim()) {
      toast.error('반려 사유를 입력해주세요')
      return
    }
    setBusy(true)
    try {
      const payload: { action: 'APPROVE' | 'REJECT'; verifyNotes?: string } = {
        action: reviewing.action,
      }
      if (reviewing.notes.trim()) payload.verifyNotes = reviewing.notes.trim()
      await onboardingTaskApi.verify(reviewing.task.id, payload)
      toast.success(reviewing.action === 'APPROVE' ? '승인 완료' : '반려 완료')
      setReviewing(null)
      await load()
    } catch (err) {
      const code = err instanceof Error ? err.message : ''
      if (code === 'CANNOT_SELF_VERIFY') {
        toast.error('본인의 태스크는 검증할 수 없습니다')
      } else {
        toast.error(`처리 실패: ${code}`)
      }
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">온보딩 검증 큐</h1>
        <p className="text-sm text-muted-foreground mt-1">
          검증 대기 태스크: {rows.length}
        </p>
      </header>

      {rows.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          현재 검증 대기 태스크가 없습니다.
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <Card key={row.id} className="p-4 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium">{row.title}</span>
                <Badge variant="outline" className="text-xs">
                  {row.onboarding.hiringDispatch?.candidateName ??
                    row.onboarding.user?.nickname ??
                    '신입 미상'}
                </Badge>
                {row.selfReportedAt && (
                  <span className="text-xs text-muted-foreground">
                    보고: {new Date(row.selfReportedAt).toLocaleString('ko-KR')}
                  </span>
                )}
              </div>
              {row.description && (
                <p className="text-sm text-muted-foreground">{row.description}</p>
              )}
              <div className="flex gap-2 justify-end pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setReviewing({ task: row, action: 'REJECT', notes: '' })
                  }
                >
                  <XCircle className="w-4 h-4 mr-1" />
                  반려
                </Button>
                <Button
                  size="sm"
                  onClick={() =>
                    setReviewing({ task: row, action: 'APPROVE', notes: '' })
                  }
                >
                  <CheckCircle2 className="w-4 h-4 mr-1" />
                  승인
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!reviewing} onOpenChange={(o) => !o && setReviewing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewing?.action === 'APPROVE' ? '태스크 승인' : '태스크 반려'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm">
              <strong>태스크:</strong> {reviewing?.task.title}
            </p>
            <Textarea
              value={reviewing?.notes ?? ''}
              onChange={(e) =>
                setReviewing((prev) => (prev ? { ...prev, notes: e.target.value } : prev))
              }
              placeholder={
                reviewing?.action === 'REJECT'
                  ? '반려 사유를 입력해주세요 (필수)'
                  : '메모 (선택)'
              }
              maxLength={2000}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewing(null)}>
              취소
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={
                busy ||
                (reviewing?.action === 'REJECT' && !reviewing?.notes.trim())
              }
              variant={reviewing?.action === 'REJECT' ? 'destructive' : 'default'}
            >
              {busy ? '처리 중…' : reviewing?.action === 'APPROVE' ? '승인' : '반려'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
