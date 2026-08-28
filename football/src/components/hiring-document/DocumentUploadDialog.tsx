import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { hiringDocumentApi, type HiringDocTarget } from '@/services/hiring-document.service'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  target: HiringDocTarget
  /**
   * When non-empty, docType is picked from these via a Select. Empty enables
   * a free-form Input (extra/ad-hoc doc).
   */
  suggestedDocTypes?: string[]
  /**
   * Pre-select a specific docType (e.g. when opened from a specific row's
   * "다시 업로드" button). Ignored if not in `suggestedDocTypes`.
   */
  preselectedDocType?: string
  onUploaded: () => void
}

/**
 * Multi-purpose upload dialog. Two docType modes:
 *   - suggestedDocTypes non-empty → dropdown + "기타(직접 입력)" escape hatch
 *   - suggestedDocTypes empty     → plain free-form input
 */
export function DocumentUploadDialog({
  open,
  onOpenChange,
  target,
  suggestedDocTypes = [],
  preselectedDocType,
  onUploaded,
}: Props) {
  const [docType, setDocType] = useState(preselectedDocType ?? '')
  const [customDocType, setCustomDocType] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [useCustom, setUseCustom] = useState(false)

  const resolvedDocType = useCustom ? customDocType : docType

  const handleUpload = async () => {
    if (!file) {
      toast.error('파일을 선택해주세요.')
      return
    }
    const trimmed = resolvedDocType.trim()
    if (!trimmed) {
      toast.error('서류 종류를 선택하거나 입력해주세요.')
      return
    }
    setUploading(true)
    try {
      await hiringDocumentApi.upload(target, trimmed, file)
      toast.success('업로드 완료')
      onUploaded()
      onOpenChange(false)
      // Reset for the next open
      setDocType(preselectedDocType ?? '')
      setCustomDocType('')
      setFile(null)
      setUseCustom(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '업로드 실패')
    } finally {
      setUploading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>채용 서류 업로드</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>서류 종류</Label>
            {suggestedDocTypes.length > 0 && !useCustom ? (
              <div className="flex gap-2">
                <Select value={docType} onValueChange={setDocType}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="서류 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {suggestedDocTypes.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setUseCustom(true)}
                >
                  기타(직접 입력)
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  value={customDocType}
                  onChange={(e) => setCustomDocType(e.target.value)}
                  placeholder="예: 자격증 사본"
                  className="flex-1"
                />
                {suggestedDocTypes.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setUseCustom(false)}
                  >
                    목록에서 선택
                  </Button>
                )}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label>파일 (PDF, DOCX, XLSX, JPG, PNG · 10MB 이하)</Label>
            <Input
              type="file"
              accept=".pdf,.docx,.xlsx,.hwp,.jpg,.jpeg,.png"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={uploading}>
            취소
          </Button>
          <Button onClick={handleUpload} disabled={uploading}>
            {uploading ? '업로드 중...' : '업로드'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
