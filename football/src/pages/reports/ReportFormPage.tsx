import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { reportApi } from '@/services/report.service'
import type { ReportType } from '@/types/report'
import { REPORT_TYPE_LABEL } from '@/types/report'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowLeft, Paperclip, X } from 'lucide-react'

const TYPES: ReportType[] = ['FINANCIAL', 'PERFORMANCE', 'MEDICAL']

export function ReportFormPage() {
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [type, setType] = useState<ReportType>('PERFORMANCE')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  const handleSave = async (asDraft: boolean) => {
    if (!title.trim()) { toast.error('제목을 입력해주세요.'); return }
    if (!content.trim()) { toast.error('내용을 입력해주세요.'); return }
    setSaving(true)
    try {
      const report = await reportApi.create({ type, title: title.trim(), content: content.trim(), file: file ?? undefined })
      if (!asDraft) {
        await reportApi.submit(report.id)
        toast.success('보고서가 제출됐습니다.')
      } else {
        toast.success('초안으로 저장됐습니다.')
      }
      navigate('/reports')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 flex items-center gap-3 shrink-0">
        <Button variant="ghost" size="icon" onClick={() => navigate('/reports')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-lg font-semibold tracking-tight">보고서 작성</h1>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl space-y-5">
          <div className="space-y-1.5">
            <Label>유형 *</Label>
            <Select value={type} onValueChange={(v) => setType(v as ReportType)}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{REPORT_TYPE_LABEL[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>제목 *</Label>
            <Input
              placeholder="보고서 제목"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>내용 *</Label>
            <Textarea
              placeholder="보고서 내용을 입력해주세요."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={12}
            />
          </div>

          <div className="space-y-1.5">
            <Label>첨부 파일</Label>
            {file ? (
              <div className="flex items-center gap-2 rounded border px-3 py-2 text-sm">
                <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="flex-1 truncate">{file.name}</span>
                <button onClick={() => setFile(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <Paperclip className="h-4 w-4 mr-1.5" />파일 첨부
              </Button>
            )}
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => navigate('/reports')} disabled={saving}>취소</Button>
            <Button variant="outline" onClick={() => handleSave(true)} disabled={saving}>초안 저장</Button>
            <Button onClick={() => handleSave(false)} disabled={saving}>
              {saving ? '처리 중...' : '제출'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
