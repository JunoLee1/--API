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
 * Contract-file upload dialog for DRAFT → ISSUED. HR selects the drafted
 * PDF (or scanned image) and the server flips the status to ISSUED after
 * storing the file. Post-ISSUED the candidate signs offline, then HR
 * uploads the signed scan via SignContractDialog to reach SIGNED.
 */
export function IssueContractDialog({ contractId, open, onOpenChange, onSuccess }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const reset = () => {
    setFile(null)
    setSubmitting(false)
  }

  const submit = async () => {
    if (contractId == null) return
    if (!file) {
      toast.error('계약서 파일을 선택해주세요.')
      return
    }
    setSubmitting(true)
    try {
      const updated = await employeeContractApi.issue(contractId, file)
      toast.success('계약서가 발행됐습니다. 지원자 서명 대기 상태입니다.')
      onSuccess(updated)
      onOpenChange(false)
      reset()
    } catch (err) {
      const code = err instanceof Error ? err.message : ''
      toast.error(messageForContractCode(code, '계약서 발행에 실패했습니다.'))
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
          <DialogTitle>계약서 발행</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            계약서 원본을 업로드하면 상태가 발행(ISSUED)으로 전환됩니다. 이후
            지원자가 오프라인으로 서명한 뒤 서명본을 업로드하면 서명 완료(SIGNED)로
            자동 전환됩니다.
          </p>
          <div className="space-y-2">
            <Label htmlFor="contract-file">계약서 파일 (PDF / JPG / PNG, 최대 10MB)</Label>
            <Input
              id="contract-file"
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
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
          <Button onClick={() => void submit()} disabled={submitting || !file}>
            발행
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
