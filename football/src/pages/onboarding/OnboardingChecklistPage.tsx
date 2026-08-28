import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { onboardingTaskApi } from '@/services/onboarding-task.service'
import type { OnboardingTask, OnboardingTaskStatus } from '@/types/onboarding-task'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { CheckCircle2, Circle, Clock, XCircle } from 'lucide-react'

const STATUS_LABEL: Record<OnboardingTaskStatus, string> = {
  PENDING: '대기',
  SELF_REPORTED: '검증 대기',
  DONE: '완료',
  SKIPPED: '건너뛰기',
}

const STATUS_STYLE: Record<OnboardingTaskStatus, string> = {
  PENDING: 'bg-slate-100 text-slate-700',
  SELF_REPORTED: 'bg-amber-100 text-amber-800',
  DONE: 'bg-emerald-100 text-emerald-800',
  SKIPPED: 'bg-slate-200 text-slate-500',
}

/**
 * OnboardingChecklistPage
 *
 * Route: `/my/onboarding` or `/onboarding/:onboardingId/checklist`.
 *
 * Owned by the trainee (task owner). Renders every OnboardingTask, allowing
 * the trainee to self-report completion (immediate DONE when the task
 * doesn't require verification, else SELF_REPORTED awaiting HR). Optional
 * tasks expose a skip button. Rejected tasks (PENDING with verifyNotes) are
 * highlighted so the trainee can re-report after fixing.
 */
export default function OnboardingChecklistPage() {
  const params = useParams<{ onboardingId?: string }>()
  const onboardingId = Number(params.onboardingId)

  const [loading, setLoading] = useState(true)
  const [tasks, setTasks] = useState<OnboardingTask[]>([])
  const [pending, setPending] = useState<number | null>(null)
  const [skipDialog, setSkipDialog] = useState<{
    task: OnboardingTask
    reason: string
  } | null>(null)

  const load = useCallback(async () => {
    if (!Number.isFinite(onboardingId) || onboardingId <= 0) return
    setLoading(true)
    try {
      const rows = await onboardingTaskApi.listByOnboardingId(onboardingId)
      setTasks(rows)
    } catch (err) {
      toast.error(`태스크 로드 실패: ${err instanceof Error ? err.message : ''}`)
    } finally {
      setLoading(false)
    }
  }, [onboardingId])

  useEffect(() => {
    void load()
  }, [load])

  const handleSelfReport = async (task: OnboardingTask) => {
    setPending(task.id)
    try {
      const updated = await onboardingTaskApi.selfReport(task.id)
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, ...updated } : t)))
      toast.success(
        task.requiresVerification ? '검증 요청을 보냈습니다' : '완료 처리했습니다',
      )
    } catch (err) {
      toast.error(`처리 실패: ${err instanceof Error ? err.message : ''}`)
    } finally {
      setPending(null)
    }
  }

  const handleSkip = async () => {
    if (!skipDialog) return
    const reason = skipDialog.reason.trim()
    if (!reason) {
      toast.error('사유를 입력해주세요')
      return
    }
    setPending(skipDialog.task.id)
    try {
      const updated = await onboardingTaskApi.skip(skipDialog.task.id, {
        skipReason: reason,
      })
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)))
      setSkipDialog(null)
      toast.success('태스크를 건너뛰었습니다')
    } catch (err) {
      toast.error(`건너뛰기 실패: ${err instanceof Error ? err.message : ''}`)
    } finally {
      setPending(null)
    }
  }

  const total = tasks.length
  const done = tasks.filter((t) => t.status === 'DONE' || t.status === 'SKIPPED').length
  const percent = total === 0 ? 0 : Math.round((done / total) * 100)

  if (loading) {
    return (
      <div className="p-6 space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">내 온보딩 체크리스트</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {done} / {total} 완료
        </p>
        <div className="mt-3">
          <Progress value={percent} />
        </div>
      </header>

      {tasks.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          아직 배정된 태스크가 없습니다.
        </Card>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => {
            const isRejected =
              task.status === 'PENDING' && !!task.verifyNotes && !!task.verifiedAt
            const isTerminal = task.status === 'DONE' || task.status === 'SKIPPED'
            const StatusIcon =
              task.status === 'DONE'
                ? CheckCircle2
                : task.status === 'SKIPPED'
                  ? XCircle
                  : task.status === 'SELF_REPORTED'
                    ? Clock
                    : Circle
            return (
              <Card
                key={task.id}
                className={`p-4 space-y-2 ${isRejected ? 'border-red-300' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <StatusIcon className="w-5 h-5 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{task.title}</span>
                      <Badge className={STATUS_STYLE[task.status]}>
                        {STATUS_LABEL[task.status]}
                      </Badge>
                      {task.optional && (
                        <Badge variant="outline" className="text-xs">
                          선택
                        </Badge>
                      )}
                      {task.requiresVerification && (
                        <Badge variant="outline" className="text-xs">
                          검증 필요
                        </Badge>
                      )}
                    </div>
                    {task.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {task.description}
                      </p>
                    )}
                    {task.dueDate && (
                      <p className="text-xs text-muted-foreground mt-1">
                        기한: {new Date(task.dueDate).toLocaleDateString('ko-KR')}
                      </p>
                    )}
                    {isRejected && (
                      <div className="mt-2 p-2 rounded bg-red-50 border border-red-200 text-sm">
                        <strong className="text-red-700">반려 사유:</strong>{' '}
                        <span className="text-red-800">{task.verifyNotes}</span>
                      </div>
                    )}
                    {task.status === 'SKIPPED' && task.skipReason && (
                      <p className="text-xs text-muted-foreground mt-1">
                        건너뛰기 사유: {task.skipReason}
                      </p>
                    )}
                  </div>
                </div>
                {!isTerminal && (
                  <div className="flex gap-2 justify-end">
                    <Button
                      onClick={() => handleSelfReport(task)}
                      disabled={pending === task.id || task.status === 'SELF_REPORTED'}
                      size="sm"
                    >
                      {task.status === 'SELF_REPORTED' ? '검증 대기 중' : '완료 마킹'}
                    </Button>
                    {task.optional && (
                      <Button
                        variant="outline"
                        onClick={() => setSkipDialog({ task, reason: '' })}
                        disabled={pending === task.id}
                        size="sm"
                      >
                        건너뛰기
                      </Button>
                    )}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      <Dialog open={!!skipDialog} onOpenChange={(o) => !o && setSkipDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>태스크 건너뛰기 사유</DialogTitle>
          </DialogHeader>
          <Textarea
            value={skipDialog?.reason ?? ''}
            onChange={(e) =>
              setSkipDialog((prev) => (prev ? { ...prev, reason: e.target.value } : prev))
            }
            placeholder="사유를 입력해주세요 (필수)"
            maxLength={500}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setSkipDialog(null)}>
              취소
            </Button>
            <Button onClick={handleSkip} disabled={!skipDialog?.reason.trim()}>
              건너뛰기 확정
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
