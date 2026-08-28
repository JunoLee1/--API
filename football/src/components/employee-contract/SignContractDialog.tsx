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
import { Input } from '@/components/ui/input'
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
 * Signed-scan upload dialog for ISSUED → SIGNED. Single action per Q4 —
 * uploading the scan implicitly flips the state to SIGNED. `signedAt` is
 * the human-provided calendar date on the signature page; the server
 * stamps `signedConfirmedAt` separately with the marking time.
 */
export function SignContractDialog({ contractId, open, onOpenChange, onSuccess }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [signedAt, setSignedAt] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)

  const reset = () => {
    setFile(null)
    setSignedAt('')
    setSubmitting(false)
  }

  const submit = async () => {
    if (contractId == null) return
    if (!file) {
      toast.error('서명본 파일을 선택해주세요.')
      return
    }
    const trimmed = signedAt.trim()
    if (!trimmed) {
      toast.error('서명 날짜를 입력해주세요.')
      return
    }
    setSubmitting(true)
    try {
      // Convert `YYYY-MM-DD` from <input type="date"> to a full ISO string
      // so the server's `new Date(input.signedAt)` parses unambiguously.
      const iso = new Date(trimmed).toISOString()
      const updated = await employeeContractApi.sign(contractId, file, iso)
      toast.success('서명 완료 처리됐습니다. 발령 실행이 가능합니다.')
      onSuccess(updated)
      onOpenChange(false)
      reset()
    } catch (err) {
      const code = err instanceof Error ? err.message : ''
      toast.error(messageForContractCode(code, '서명 확인 처리에 실패했습니다.'))
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
          <DialogTitle>서명본 업로드</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            지원자가 서명한 계약서 스캔본을 업로드하고, 실제 서명 날짜를
            입력해주세요. 업로드 즉시 서명 완료(SIGNED)로 처리되고 발령
            실행 게이트가 열립니다.
          </p>
          <div className="space-y-2">
            <Label htmlFor="signed-file">서명본 파일 (PDF / JPG / PNG, 최대 10MB)</Label>
            <Input
              id="signed-file"
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              disabled={submitting}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="signed-at">서명 날짜</Label>
            <Input
              id="signed-at"
              type="date"
              value={signedAt}
              onChange={(e) => setSignedAt(e.target.value)}
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
            onClick={() => void submit()}
            disabled={submitting || !file || !signedAt}
          >
            서명 완료 처리
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
