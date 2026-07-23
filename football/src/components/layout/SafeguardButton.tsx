import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { safeguardApi } from '@/services/safeguard.service'

export function SafeguardButton() {
  const [open, setOpen] = useState(false)
  const [description, setDescription] = useState('')
  const [contactInfo, setContactInfo] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (description.trim().length < 10) {
      setError('내용을 10자 이상 입력해주세요.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      await safeguardApi.submit({
        description: description.trim(),
        ...(contactInfo.trim() && { contactInfo: contactInfo.trim() }),
      })
      setSubmitted(true)
      setDescription('')
      setContactInfo('')
    } catch {
      setError('제출 중 오류가 발생했습니다. 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setOpen(false)
    setSubmitted(false)
    setError(null)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-red-600 text-white shadow-lg hover:bg-red-700 active:scale-95 transition-transform flex items-center justify-center text-xl"
        title="유소년 보호 신고"
        aria-label="유소년 보호 익명 신고"
      >
        🚨
      </button>

      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600">🚨 유소년 보호 신고</DialogTitle>
          </DialogHeader>

          {submitted ? (
            <div className="space-y-4 text-center py-4">
              <p className="text-green-600 font-semibold">신고가 접수됐습니다.</p>
              <p className="text-sm text-muted-foreground">
                관리자에게 즉시 전달되며 신속하게 처리됩니다.<br />
                신고자의 신원은 보호됩니다.
              </p>
              <Button onClick={handleClose}>닫기</Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                신체적·언어적·정서적 학대 또는 가혹 행위를 목격하거나 경험했다면 익명으로 신고하세요.
                신고자의 신원은 시스템에 저장되지 않습니다.
              </p>
              <div>
                <Label>사건 내용 <span className="text-red-500">*</span></Label>
                <Textarea
                  rows={5}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="언제, 어디서, 무슨 일이 있었는지 구체적으로 서술해주세요..."
                  className="mt-1"
                />
              </div>
              <div>
                <Label>연락처 (선택 — 익명 유지 시 비워두세요)</Label>
                <input
                  type="text"
                  className="w-full mt-1 border rounded px-3 py-2 text-sm"
                  value={contactInfo}
                  onChange={e => setContactInfo(e.target.value)}
                  placeholder="전화번호 또는 이메일 (선택)"
                />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleClose}>취소</Button>
                <Button
                  className="bg-red-600 hover:bg-red-700 text-white"
                  onClick={() => void handleSubmit()}
                  disabled={loading}
                >
                  {loading ? '제출 중...' : '익명으로 신고하기'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
