import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ChevronLeft } from 'lucide-react'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { medicalEquipmentLoanApi } from '@/services/medical-equipment-loan.service'
import {
  MEDICAL_LOAN_STATUS_LABEL,
  MEDICAL_LOAN_STATUS_STYLE,
  type MedicalEquipmentLoanLedger,
} from '@/types/medical-equipment-loan'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

function fmtWon(n: number) {
  return `${n.toLocaleString('ko-KR')}원`
}

function fmtDate(s?: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleString('ko-KR')
}

function EmergencySlaInfo({ issuedAt }: { issuedAt?: string | null }) {
  if (!issuedAt) return null
  const issuedMs = new Date(issuedAt).getTime()
  const deadlineMs = issuedMs + 24 * 60 * 60 * 1000 // D+1
  const nowMs = Date.now()
  const diffMs = deadlineMs - nowMs
  const diffH = Math.floor(Math.abs(diffMs) / (60 * 60 * 1000))
  const diffM = Math.floor((Math.abs(diffMs) % (60 * 60 * 1000)) / (60 * 1000))
  const overdue = diffMs < 0

  return (
    <div className={`text-xs ${overdue ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
      D+1 사후 승인 기한:{' '}
      {overdue
        ? `기한 초과 (${diffH}시간 ${diffM}분 경과)`
        : `${diffH}시간 ${diffM}분 남음`}
    </div>
  )
}

function RejectModal({
  open,
  onOpenChange,
  onConfirm,
  loading,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onConfirm: (reason: string) => void
  loading: boolean
}) {
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (open) setReason('')
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>반려 사유 입력</DialogTitle>
        </DialogHeader>
        <div className="py-2">
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            placeholder="반려 이유를 입력해주세요"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            취소
          </Button>
          <Button
            variant="destructive"
            disabled={!reason.trim() || loading}
            onClick={() => onConfirm(reason.trim())}
          >
            {loading ? '처리 중...' : '반려'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ApproveModal({
  open,
  onOpenChange,
  needsBudget,
  onConfirm,
  loading,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  needsBudget: boolean
  onConfirm: (body?: { budgetLineId?: number; seasonId?: number; categoryId?: number }) => void
  loading: boolean
}) {
  const [budgetLineId, setBudgetLineId] = useState('')
  const [seasonId, setSeasonId] = useState('')
  const [categoryId, setCategoryId] = useState('')

  useEffect(() => {
    if (open) {
      setBudgetLineId('')
      setSeasonId('')
      setCategoryId('')
    }
  }, [open])

  const handleConfirm = () => {
    if (needsBudget) {
      const bl = parseInt(budgetLineId, 10)
      const si = parseInt(seasonId, 10)
      const ci = parseInt(categoryId, 10)
      if (!Number.isFinite(bl) || bl <= 0) { toast.error('예산 라인 ID를 입력해주세요'); return }
      if (!Number.isFinite(si) || si <= 0) { toast.error('시즌 ID를 입력해주세요'); return }
      if (!Number.isFinite(ci) || ci <= 0) { toast.error('카테고리 ID를 입력해주세요'); return }
      onConfirm({ budgetLineId: bl, seasonId: si, categoryId: ci })
    } else {
      onConfirm()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {needsBudget ? '사후 승인 — 예산 배정' : '승인 확인'}
          </DialogTitle>
        </DialogHeader>
        <div className="py-2 space-y-3">
          {needsBudget ? (
            <>
              <p className="text-sm text-muted-foreground">
                응급 발급 건입니다. 예산 라인·시즌·카테고리를 지정하여 사후 승인합니다.
              </p>
              {/* TODO: replace plain ID inputs with budget-line API picker */}
              <div className="space-y-1.5">
                <Label>예산 라인 ID *</Label>
                <Input type="number" value={budgetLineId} onChange={(e) => setBudgetLineId(e.target.value)} placeholder="1" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label>시즌 ID *</Label>
                  <Input type="number" value={seasonId} onChange={(e) => setSeasonId(e.target.value)} placeholder="1" />
                </div>
                <div className="space-y-1.5">
                  <Label>카테고리 ID *</Label>
                  <Input type="number" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} placeholder="1" />
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">이 신청을 승인하시겠습니까?</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            취소
          </Button>
          <Button onClick={handleConfirm} disabled={loading}>
            {loading ? '처리 중...' : '승인'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function MedicalEquipmentLoanDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useCurrentUser()
  const [ledger, setLedger] = useState<MedicalEquipmentLoanLedger | null>(null)
  const [loading, setLoading] = useState(true)
  const [approveOpen, setApproveOpen] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [acting, setActing] = useState(false)

  const numId = id ? parseInt(id, 10) : null

  const loadLedger = async () => {
    if (!numId) return
    setLoading(true)
    try {
      const data = await medicalEquipmentLoanApi.get(numId)
      setLedger(data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '조회에 실패했습니다')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadLedger()
  }, [numId])

  const isMedicalDirector =
    user?.role === 'ADMIN' ||
    (user?.role === 'COACHING_STAFF' && user?.coachingRole === 'MEDICAL_DIRECTOR')

  const canAct =
    isMedicalDirector &&
    ledger &&
    (ledger.status === 'DRAFT' || ledger.status === 'EMERGENCY_PENDING_POST_APPROVAL')

  const handleApprove = async (body?: { budgetLineId?: number; seasonId?: number; categoryId?: number }) => {
    if (!numId) return
    setActing(true)
    try {
      await medicalEquipmentLoanApi.approve(numId, body)
      toast.success('승인됐습니다')
      setApproveOpen(false)
      void loadLedger()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '승인에 실패했습니다')
    } finally {
      setActing(false)
    }
  }

  const handleReject = async (reason: string) => {
    if (!numId) return
    setActing(true)
    try {
      await medicalEquipmentLoanApi.reject(numId, reason)
      toast.success('반려됐습니다')
      setRejectOpen(false)
      void loadLedger()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '반려에 실패했습니다')
    } finally {
      setActing(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b px-6 py-4 flex items-center gap-3 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2"
          onClick={() => navigate('/medical/equipment-loan')}
        >
          <ChevronLeft className="h-4 w-4" />
          목록
        </Button>
        <h1 className="text-lg font-semibold tracking-tight">
          의무기기 대여 #{numId}
        </h1>
        {ledger && (
          <Badge className={MEDICAL_LOAN_STATUS_STYLE[ledger.status]}>
            {MEDICAL_LOAN_STATUS_LABEL[ledger.status]}
          </Badge>
        )}
        <div className="flex-1" />
        {canAct && (
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setApproveOpen(true)} disabled={acting}>
              승인
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setRejectOpen(true)}
              disabled={acting}
            >
              반려
            </Button>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto p-6">
        {loading || !ledger ? (
          <div className="space-y-2 max-w-2xl">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        ) : (
          <div className="max-w-2xl space-y-6 text-sm">
            {/* 기본정보 */}
            <section>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">기본 정보</h2>
              <div className="grid grid-cols-3 gap-y-2">
                <span className="text-muted-foreground">장비명</span>
                <span className="col-span-2">
                  {ledger.equipmentLoan?.equipmentItem?.name ?? `대여 ID #${ledger.equipmentLoanId}`}
                </span>

                <span className="text-muted-foreground">요청자</span>
                <span className="col-span-2">
                  {ledger.requestedBy?.nickname ?? `ID:${ledger.requestedById}`}
                </span>

                {ledger.approvedBy && (
                  <>
                    <span className="text-muted-foreground">승인자</span>
                    <span className="col-span-2">{ledger.approvedBy.nickname}</span>
                  </>
                )}

                <span className="text-muted-foreground">승인일시</span>
                <span className="col-span-2">{fmtDate(ledger.approvedAt)}</span>

                {ledger.rejectionReason && (
                  <>
                    <span className="text-muted-foreground">반려 사유</span>
                    <span className="col-span-2 whitespace-pre-wrap">{ledger.rejectionReason}</span>
                  </>
                )}

                <span className="text-muted-foreground">생성일시</span>
                <span className="col-span-2">{fmtDate(ledger.createdAt)}</span>
              </div>
            </section>

            {/* 파트너·할인 */}
            <section>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">파트너 · 할인</h2>
              <div className="grid grid-cols-3 gap-y-2">
                <span className="text-muted-foreground">파트너</span>
                <span className="col-span-2">{ledger.partner?.name ?? '—'}</span>

                <span className="text-muted-foreground">원가</span>
                <span className="col-span-2 tabular-nums">{fmtWon(ledger.originalCost)}</span>

                <span className="text-muted-foreground">할인율</span>
                <span className="col-span-2 tabular-nums">{ledger.discountRate}%</span>

                <span className="text-muted-foreground">실부담</span>
                <span className="col-span-2 tabular-nums font-medium">{fmtWon(ledger.finalCost)}</span>

                {ledger.overrideReason && (
                  <>
                    <span className="text-muted-foreground">오버라이드 사유</span>
                    <span className="col-span-2">{ledger.overrideReason}</span>
                  </>
                )}
              </div>
            </section>

            {/* 응급 정보 */}
            {ledger.isEmergency && (
              <section>
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">응급 정보</h2>
                <div className="grid grid-cols-3 gap-y-2">
                  <span className="text-muted-foreground">응급 사유</span>
                  <span className="col-span-2 whitespace-pre-wrap">{ledger.emergencyReason ?? '—'}</span>

                  <span className="text-muted-foreground">발급일시</span>
                  <span className="col-span-2">
                    {fmtDate(ledger.equipmentLoan?.issuedAt)}
                  </span>

                  <span className="text-muted-foreground">에스컬레이션</span>
                  <span className="col-span-2">{fmtDate(ledger.escalatedAt)}</span>
                </div>
                {ledger.status === 'EMERGENCY_PENDING_POST_APPROVAL' && ledger.equipmentLoan?.issuedAt && (
                  <div className="mt-2">
                    <EmergencySlaInfo issuedAt={ledger.equipmentLoan.issuedAt} />
                  </div>
                )}
              </section>
            )}

            {/* 예산 정보 */}
            <section>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">예산 정보</h2>
              <div className="grid grid-cols-3 gap-y-2">
                <span className="text-muted-foreground">예산 라인 ID</span>
                <span className="col-span-2">{ledger.budgetLineId ?? '—'}</span>

                <span className="text-muted-foreground">운영비 지출 ID</span>
                <span className="col-span-2">{ledger.operatingExpenseId ?? '—'}</span>
              </div>
            </section>
          </div>
        )}
      </div>

      {/* Modals */}
      {ledger && (
        <>
          <ApproveModal
            open={approveOpen}
            onOpenChange={setApproveOpen}
            needsBudget={ledger.status === 'EMERGENCY_PENDING_POST_APPROVAL'}
            onConfirm={(body) => void handleApprove(body)}
            loading={acting}
          />
          <RejectModal
            open={rejectOpen}
            onOpenChange={setRejectOpen}
            onConfirm={(reason) => void handleReject(reason)}
            loading={acting}
          />
        </>
      )}
    </div>
  )
}
