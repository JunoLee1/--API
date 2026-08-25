import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { medicalEquipmentLoanApi } from '@/services/medical-equipment-loan.service'
import { equipmentApi } from '@/services/equipment.service'
import type { EquipmentItem } from '@/types/equipment'
import {
  MEDICAL_LOAN_STATUS_LABEL,
  MEDICAL_LOAN_STATUS_STYLE,
  type MedicalEquipmentLoanLedger,
  type RequestNormalMedicalLoanDto,
  type RequestEmergencyMedicalLoanDto,
} from '@/types/medical-equipment-loan'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

function fmtWon(n: number) {
  return `${n.toLocaleString('ko-KR')}원`
}

interface RequestFormState {
  isEmergency: boolean
  equipmentItemId: string
  originalCost: string
  notes: string
  emergencyReason: string
  overrideDiscountRate: string
  overrideReason: string
  // Normal-only: MVP — plain number inputs (TODO: replace with budget-line API picker)
  budgetLineId: string
  seasonId: string
  categoryId: string
}

const emptyForm: RequestFormState = {
  isEmergency: false,
  equipmentItemId: '',
  originalCost: '',
  notes: '',
  emergencyReason: '',
  overrideDiscountRate: '',
  overrideReason: '',
  budgetLineId: '',
  seasonId: '',
  categoryId: '',
}

function RequestDialog({
  open,
  onOpenChange,
  equipmentItems,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  equipmentItems: EquipmentItem[]
  onSuccess: () => void
}) {
  const [form, setForm] = useState<RequestFormState>(emptyForm)
  const [saving, setSaving] = useState(false)

  // Reset form when dialog opens
  useEffect(() => {
    if (open) setForm(emptyForm)
  }, [open])

  const set = <K extends keyof RequestFormState>(k: K, v: RequestFormState[K]) =>
    setForm((p) => ({ ...p, [k]: v }))

  const originalCostNum = parseInt(form.originalCost.replace(/[^0-9]/g, ''), 10)
  const overrideRate = form.overrideDiscountRate ? parseFloat(form.overrideDiscountRate) : null
  // Preview: finalCost preview (actual rate resolved server-side; this is a local estimate)
  const previewFinal =
    Number.isFinite(originalCostNum) && overrideRate !== null && Number.isFinite(overrideRate)
      ? Math.round(originalCostNum * (1 - overrideRate / 100))
      : null

  const handleSubmit = async () => {
    if (!form.equipmentItemId) {
      toast.error('장비를 선택해주세요')
      return
    }
    const cost = parseInt(form.originalCost.replace(/[^0-9]/g, ''), 10)
    if (!Number.isFinite(cost) || cost <= 0) {
      toast.error('원가를 입력해주세요')
      return
    }

    if (form.isEmergency) {
      if (!form.emergencyReason.trim()) {
        toast.error('응급 사유는 필수입니다')
        return
      }
      const dto: RequestEmergencyMedicalLoanDto = {
        equipmentItemId: parseInt(form.equipmentItemId, 10),
        originalCost: cost,
        emergencyReason: form.emergencyReason.trim(),
        ...(form.notes.trim() && { notes: form.notes.trim() }),
        ...(form.overrideDiscountRate && { overrideDiscountRate: parseFloat(form.overrideDiscountRate) }),
        ...(form.overrideReason.trim() && { overrideReason: form.overrideReason.trim() }),
      }
      setSaving(true)
      try {
        await medicalEquipmentLoanApi.requestEmergency(dto)
        toast.success('응급 대여 신청이 완료됐습니다')
        onOpenChange(false)
        onSuccess()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : '응급 신청에 실패했습니다')
      } finally {
        setSaving(false)
      }
    } else {
      // Normal: budgetLineId / seasonId / categoryId required
      // TODO: replace plain number inputs with budget-line API picker
      const budgetLineId = parseInt(form.budgetLineId, 10)
      const seasonId = parseInt(form.seasonId, 10)
      const categoryId = parseInt(form.categoryId, 10)
      if (!Number.isFinite(budgetLineId) || budgetLineId <= 0) {
        toast.error('예산 라인 ID를 입력해주세요 (숫자)')
        return
      }
      if (!Number.isFinite(seasonId) || seasonId <= 0) {
        toast.error('시즌 ID를 입력해주세요 (숫자)')
        return
      }
      if (!Number.isFinite(categoryId) || categoryId <= 0) {
        toast.error('카테고리 ID를 입력해주세요 (숫자)')
        return
      }
      const dto: RequestNormalMedicalLoanDto = {
        equipmentItemId: parseInt(form.equipmentItemId, 10),
        originalCost: cost,
        budgetLineId,
        seasonId,
        categoryId,
        ...(form.notes.trim() && { notes: form.notes.trim() }),
        ...(form.overrideDiscountRate && { overrideDiscountRate: parseFloat(form.overrideDiscountRate) }),
        ...(form.overrideReason.trim() && { overrideReason: form.overrideReason.trim() }),
      }
      setSaving(true)
      try {
        await medicalEquipmentLoanApi.requestNormal(dto)
        toast.success('의무기기 대여 신청이 완료됐습니다')
        onOpenChange(false)
        onSuccess()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : '신청에 실패했습니다')
      } finally {
        setSaving(false)
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>의무기기 대여 신청</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2 max-h-[70vh] overflow-y-auto pr-1">
          {/* Emergency toggle */}
          <div className="space-y-1.5">
            <Label>신청 유형</Label>
            <div className="flex gap-4 text-sm">
              {([false, true] as const).map((v) => (
                <label key={String(v)} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="isEmergency"
                    checked={form.isEmergency === v}
                    onChange={() => set('isEmergency', v)}
                  />
                  {v ? '응급' : '일반'}
                </label>
              ))}
            </div>
          </div>

          {/* Equipment item */}
          <div className="space-y-1.5">
            <Label>장비 *</Label>
            <select
              className="w-full border rounded px-3 py-1.5 text-sm bg-transparent"
              value={form.equipmentItemId}
              onChange={(e) => set('equipmentItemId', e.target.value)}
            >
              <option value="">-- 장비를 선택해주세요 --</option>
              {equipmentItems.map((eq) => (
                <option key={eq.id} value={eq.id}>
                  {eq.name}
                </option>
              ))}
            </select>
          </div>

          {/* Original cost */}
          <div className="space-y-1.5">
            <Label>원가 (원) *</Label>
            <Input
              type="text"
              inputMode="numeric"
              value={form.originalCost ? Number(form.originalCost.replace(/[^0-9]/g, '')).toLocaleString('ko-KR') : ''}
              onChange={(e) => set('originalCost', e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="100,000"
            />
          </div>

          {/* Emergency reason */}
          {form.isEmergency && (
            <div className="space-y-1.5">
              <Label>응급 사유 *</Label>
              <Textarea
                value={form.emergencyReason}
                onChange={(e) => set('emergencyReason', e.target.value)}
                rows={3}
                placeholder="응급 사유를 구체적으로 입력해주세요"
              />
            </div>
          )}

          {/* Normal only: budgetLineId / seasonId / categoryId */}
          {/* TODO: replace these raw ID inputs with budget-line API picker when available on FE */}
          {!form.isEmergency && (
            <>
              <div className="space-y-1.5">
                <Label>예산 라인 ID *</Label>
                <Input
                  type="number"
                  value={form.budgetLineId}
                  onChange={(e) => set('budgetLineId', e.target.value)}
                  placeholder="1"
                />
                <p className="text-xs text-muted-foreground">TODO: 예산 라인 선택 UI로 교체 예정</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label>시즌 ID *</Label>
                  <Input
                    type="number"
                    value={form.seasonId}
                    onChange={(e) => set('seasonId', e.target.value)}
                    placeholder="1"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>카테고리 ID *</Label>
                  <Input
                    type="number"
                    value={form.categoryId}
                    onChange={(e) => set('categoryId', e.target.value)}
                    placeholder="1"
                  />
                </div>
              </div>
            </>
          )}

          {/* Override discount */}
          <div className="space-y-1.5">
            <Label>할인율 오버라이드 (%)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={form.overrideDiscountRate}
              onChange={(e) => set('overrideDiscountRate', e.target.value)}
              placeholder="기본 파트너 할인율 사용"
            />
          </div>
          {form.overrideDiscountRate && (
            <div className="space-y-1.5">
              <Label>오버라이드 사유 *</Label>
              <Input
                value={form.overrideReason}
                onChange={(e) => set('overrideReason', e.target.value)}
                placeholder="기본 할인율을 변경하는 이유"
              />
            </div>
          )}

          {/* Cost preview */}
          {previewFinal !== null && (
            <div className="rounded-md bg-muted px-3 py-2 text-sm">
              <span className="text-muted-foreground">예상 실부담: </span>
              <span className="font-medium">{fmtWon(previewFinal)}</span>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>비고</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              rows={2}
              placeholder="기타 참고 사항"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            취소
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={saving}>
            {saving ? '제출 중...' : '신청'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function MedicalEquipmentLoanPage() {
  const { user } = useCurrentUser()
  const navigate = useNavigate()
  const [ledgers, setLedgers] = useState<MedicalEquipmentLoanLedger[]>([])
  const [loading, setLoading] = useState(true)
  const [equipmentItems, setEquipmentItems] = useState<EquipmentItem[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)

  const loadLedgers = async () => {
    setLoading(true)
    try {
      const data = await medicalEquipmentLoanApi.list()
      setLedgers(data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '목록 조회에 실패했습니다')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadLedgers()
    void equipmentApi.listItems().then(setEquipmentItems).catch(() => null)
  }, [])

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">의무기기 대여 대장</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            의무팀 장비 대여 신청·승인·응급 발급 이력을 관리합니다.
          </p>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)} disabled={!user}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />신청하기
        </Button>
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : ledgers.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
            아직 대여 내역이 없습니다.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>장비명</TableHead>
                <TableHead>요청자</TableHead>
                <TableHead>상태</TableHead>
                <TableHead className="text-right">할인율</TableHead>
                <TableHead className="text-right">실부담</TableHead>
                <TableHead className="text-center">응급</TableHead>
                <TableHead>일자</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ledgers.map((r) => (
                <TableRow
                  key={r.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/medical/equipment-loan/${r.id}`)}
                >
                  <TableCell className="text-sm">
                    {r.equipmentLoan?.equipmentItem?.name ?? `장비 #${r.equipmentLoanId}`}
                  </TableCell>
                  <TableCell className="text-sm">
                    {r.requestedBy?.nickname ?? `ID:${r.requestedById}`}
                  </TableCell>
                  <TableCell>
                    <Badge className={MEDICAL_LOAN_STATUS_STYLE[r.status]}>
                      {MEDICAL_LOAN_STATUS_LABEL[r.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="tabular-nums text-sm text-right">
                    {r.discountRate}%
                  </TableCell>
                  <TableCell className="tabular-nums font-medium text-sm text-right">
                    {fmtWon(r.finalCost)}
                  </TableCell>
                  <TableCell className="text-center text-sm">
                    {r.isEmergency ? '✓' : '—'}
                  </TableCell>
                  <TableCell className="tabular-nums text-sm">
                    {new Date(r.createdAt).toLocaleDateString('ko-KR')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <RequestDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        equipmentItems={equipmentItems}
        onSuccess={() => void loadLedgers()}
      />
    </div>
  )
}
