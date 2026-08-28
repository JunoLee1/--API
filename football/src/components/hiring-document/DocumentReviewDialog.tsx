import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { hiringDocumentApi } from '@/services/hiring-document.service'
import type { HiringDocument } from '@/types/hiring-document'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  document: HiringDocument | null
  onReviewed: () => void
}

/**
 * Dialog for approving/rejecting a PENDING document. Rejection requires a
 * non-empty note (enforced BE-side too). Approval note is optional.
 */
export function DocumentReviewDialog({ open, onOpenChange, document, onReviewed }: Props) {
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)

  const handleReview = async (status: 'APPROVED' | 'REJECTED') => {
    if (!document) return
    if (status === 'REJECTED' && !notes.trim()) {
      toast.error('반려 시 사유는 필수입니다.')
      return
    }
    setBusy(true)
    try {
      await hiringDocumentApi.review(document.id, status, notes.trim() || undefined)
      toast.success(status === 'APPROVED' ? '승인 완료' : '반려 완료')
      onReviewed()
      onOpenChange(false)
      setNotes('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '검토 실패')
    } finally {
      setBusy(false)
    }
  }

  if (!document) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>서류 검토 — {document.docType}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            <div>파일: {document.fileName ?? '(이름 없음)'}</div>
            <div>업로드: {document.uploadedBy.nickname} · {new Date(document.uploadedAt).toLocaleString('ko-KR')}</div>
            <a
              href={document.fileUrl}
              target="_blank"
              rel="noreferrer"
              className="text-primary underline"
            >
              파일 열기
            </a>
          </div>
          <div className="space-y-2">
            <Label>검토 의견 (반려 시 필수)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="반려하는 경우 사유를 입력하세요."
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            취소
          </Button>
          <Button variant="destructive" onClick={() => handleReview('REJECTED')} disabled={busy}>
            반려
          </Button>
          <Button onClick={() => handleReview('APPROVED')} disabled={busy}>
            승인
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
