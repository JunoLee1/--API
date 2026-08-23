import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface Props {
  open: boolean
  onOpenChange: (o: boolean) => void
  currentAmount: number
  onSubmit: (amount: number, reason: string) => Promise<void>
}

/**
 * Manual carryOverFromPrev override dialog. After submit, the parent should
 * refresh the WageCapKPI to reflect the new value + isAutoCalculated=false.
 */
export function CarryOverOverrideDialog({
  open,
  onOpenChange,
  currentAmount,
  onSubmit,
}: Props) {
  const [amount, setAmount] = useState(currentAmount.toString())
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  // Reset the amount when the dialog is (re)opened so it always reflects the
  // latest server value rather than a stale draft from a prior open.
  useEffect(() => {
    if (open) {
      setAmount(currentAmount.toString())
      setReason('')
    }
  }, [open, currentAmount])

  const submit = async () => {
    setSaving(true)
    try {
      await onSubmit(Number(amount), reason.trim())
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>이월금 수동 조정</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>이월금 (원)</Label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <Label>사유</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="예: 리스크 준비금 차감"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button onClick={submit} disabled={saving || !reason.trim()}>
            {saving ? '저장 중...' : '조정'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
