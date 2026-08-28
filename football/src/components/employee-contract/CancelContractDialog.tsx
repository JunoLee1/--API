import { useState } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { employeeContractApi } from '@/services/employee-contract.service'
import type { EmployeeContract } from '@/types/employee-contract'
import { messageForContractCode } from './employee-contract.messages'

interface Props {
  contractId: number | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (updated: EmployeeContract) => void
}

/**
 * Cancel-with-reason dialog. Applies to any non-CANCELLED row (DRAFT /
 * ISSUED / SIGNED). Re-issue after cancel is a *new* row — the flow is
 * cancel here → open the section and press "새 계약서 발행".
 */
export function CancelContractDialog({ contractId, open, onOpenChange, onSuccess }: Props) {
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const reset = () => {
    setReason('')
    setSubmitting(false)
  }

  const submit = async () => {
    if (contractId == null) return
    const trimmed = reason.trim()
    if (!trimmed) {
      toast.error('취소 사유를 입력해주세요.')
      return
    }
    if (trimmed.length > 2000) {
      toast.error('취소 사유는 2000자 이내로 입력해주세요.')
      return
    }
    setSubmitting(true)
    try {
      const updated = await employeeContractApi.cancel(contractId, trimmed)
      toast.success('계약서가 취소됐습니다. 필요 시 새 계약서를 발행해주세요.')
      onSuccess(updated)
      onOpenChange(false)
      reset()
    } catch (err) {
      const code = err instanceof Error ? err.message : ''
      toast.error(messageForContractCode(code, '계약서 취소에 실패했습니다.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset()
        onOpenChange(o)
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>계약서 취소</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm text-muted-foreground">
            취소 후 재발행이 필요한 경우 새 계약서(DRAFT)를 생성해주세요. 취소된
            계약서는 이력에 남으며 게이트 판정에서 제외됩니다.
          </p>
          <div className="space-y-2">
            <Label htmlFor="cancel-reason">취소 사유 (필수)</Label>
            <Textarea
              id="cancel-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="예: 지원자 사퇴, 조건 재협상 필요"
              autoFocus
              disabled={submitting}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            닫기
          </Button>
          <Button
            variant="destructive"
            onClick={() => void submit()}
            disabled={submitting || !reason.trim()}
          >
            취소
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
