import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { staffRecordApi, type StaffRecord } from "@/services/staff-record.service"
import {
  probationReviewApi,
  type ProbationReview,
  type ProbationReviewType,
  type SubmitProbationReviewPayload,
} from "@/services/probation-review.service"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const REVIEW_TYPE_LABEL: Record<ProbationReviewType, string> = {
  THREE_MO: "3개월",
  SIX_MO: "6개월",
}

function statusBadge(s: "IN_PROGRESS" | "PASSED" | "FAILED" | undefined) {
  if (s === "PASSED") return <Badge variant="default">통과</Badge>
  if (s === "FAILED") return <Badge variant="destructive">미통과</Badge>
  return <Badge variant="secondary">수습 중</Badge>
}

function reviewStatusBadge(s: ProbationReview["status"]) {
  if (s === "PASSED") return <Badge variant="default">통과</Badge>
  if (s === "FAILED") return <Badge variant="destructive">미통과</Badge>
  return <Badge variant="secondary">대기</Badge>
}

const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("ko-KR") : "-"

/**
 * 부서장/HR 이 수습 직원의 3MO/6MO 평가를 제출한다.
 * 각 행 클릭 → 히스토리 + 신규 review 제출 다이얼로그.
 *
 * 수습 완료(PASSED/FAILED) 인 직원은 목록에서 숨긴다 — 신규 평가 대상이 아니므로.
 */
export function ProbationReviewPage() {
  const [records, setRecords] = useState<StaffRecord[]>([])
  const [selected, setSelected] = useState<StaffRecord | null>(null)
  const [reviews, setReviews] = useState<ProbationReview[]>([])
  const [form, setForm] = useState<SubmitProbationReviewPayload>({
    reviewType: "THREE_MO",
    status: "PASSED",
    leaderAssessment: "",
  })
  const [saving, setSaving] = useState(false)

  const fetchStaff = async () => {
    try {
      const rows = await staffRecordApi.list(true)
      setRecords(rows)
    } catch {
      toast.error("직원 목록을 불러오지 못했어요")
    }
  }

  useEffect(() => {
    void fetchStaff()
  }, [])

  const inProbation = useMemo(
    () => records.filter((r) => r.probationStatus === "IN_PROGRESS" && r.probationStartedAt),
    [records],
  )

  const openReviewDialog = async (staff: StaffRecord) => {
    setSelected(staff)
    setForm({ reviewType: "THREE_MO", status: "PASSED", leaderAssessment: "" })
    try {
      setReviews(await probationReviewApi.list(staff.id))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "이력 조회 실패")
      setReviews([])
    }
  }

  const handleSubmit = async () => {
    if (!selected) return
    if (!form.leaderAssessment.trim()) {
      toast.error("평가 내용을 입력해주세요")
      return
    }
    setSaving(true)
    try {
      await probationReviewApi.submit(selected.id, form)
      toast.success("수습 평가를 제출했어요")
      setReviews(await probationReviewApi.list(selected.id))
      await fetchStaff()
      setSelected(null)
    } catch (err) {
      const code = err instanceof Error ? err.message : "저장 실패"
      const messageByCode: Record<string, string> = {
        REVIEW_ALREADY_COMPLETED: "이미 제출된 평가는 수정할 수 없어요",
        PROBATION_ALREADY_ENDED: "이미 수습이 종료된 직원이에요",
        PROBATION_NOT_STARTED: "수습이 아직 시작되지 않은 직원이에요",
        NOT_DEPARTMENT_HEAD: "부서장/HR/관리자만 제출할 수 있어요",
        ASSESSMENT_REQUIRED: "평가 내용을 입력해주세요",
        STAFF_RECORD_NOT_FOUND: "직원 정보를 찾을 수 없어요",
      }
      toast.error(messageByCode[code] ?? code)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">신규 직원 팔로우업</h1>
        <p className="text-sm text-muted-foreground">
          수습 중인 직원을 클릭하면 3개월/6개월 평가를 제출할 수 있어요.
        </p>
      </header>

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="py-2 pr-4">이름</th>
            <th className="py-2 pr-4">역할</th>
            <th className="py-2 pr-4">부서</th>
            <th className="py-2 pr-4">수습 시작일</th>
            <th className="py-2 pr-4">상태</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {inProbation.map((r) => (
            <tr key={r.id} className="border-b hover:bg-muted/30">
              <td className="py-2 pr-4 font-medium">{r.name}</td>
              <td className="py-2 pr-4">{r.role}</td>
              <td className="py-2 pr-4 text-muted-foreground">
                {r.department?.name ?? "-"}
              </td>
              <td className="py-2 pr-4 text-muted-foreground">
                {fmtDate(r.probationStartedAt)}
              </td>
              <td className="py-2 pr-4">{statusBadge(r.probationStatus)}</td>
              <td className="py-2 text-right">
                <Button size="sm" variant="outline" onClick={() => void openReviewDialog(r)}>
                  평가하기
                </Button>
              </td>
            </tr>
          ))}
          {inProbation.length === 0 && (
            <tr>
              <td colSpan={6} className="py-8 text-center text-muted-foreground">
                수습 중인 직원이 없어요.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selected?.name} — 수습 평가
            </DialogTitle>
          </DialogHeader>

          {selected && (
            <div className="space-y-6">
              <section>
                <h3 className="text-sm font-semibold mb-2">평가 이력</h3>
                {reviews.length === 0 ? (
                  <p className="text-sm text-muted-foreground">아직 제출된 평가가 없어요.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {reviews.map((r) => (
                      <li key={r.id} className="flex items-start justify-between border rounded p-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{REVIEW_TYPE_LABEL[r.reviewType]}</Badge>
                            {reviewStatusBadge(r.status)}
                            <span className="text-xs text-muted-foreground">{fmtDate(r.reviewedAt)}</span>
                          </div>
                          {r.leaderAssessment && (
                            <p className="mt-1 text-muted-foreground whitespace-pre-wrap">
                              {r.leaderAssessment}
                            </p>
                          )}
                        </div>
                        {r.reviewedBy && (
                          <span className="text-xs text-muted-foreground shrink-0">
                            {r.reviewedBy.nickname}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold">새 평가 제출</h3>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>평가 시점</Label>
                    <Select
                      value={form.reviewType}
                      onValueChange={(v) =>
                        setForm((f) => ({ ...f, reviewType: v as ProbationReviewType }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="THREE_MO">3개월</SelectItem>
                        <SelectItem value="SIX_MO">6개월</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label>결과</Label>
                    <Select
                      value={form.status}
                      onValueChange={(v) =>
                        setForm((f) => ({
                          ...f,
                          status: v as SubmitProbationReviewPayload["status"],
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PASSED">통과</SelectItem>
                        <SelectItem value="FAILED">미통과</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label>평가 내용</Label>
                  <Textarea
                    rows={4}
                    value={form.leaderAssessment}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, leaderAssessment: e.target.value }))
                    }
                    placeholder="부서장의 평가를 자유롭게 입력해주세요."
                  />
                </div>

                <div className="text-xs text-muted-foreground space-y-1">
                  <p>• 6개월 평가가 통과되면 수습이 완료돼요.</p>
                  <p>• 미통과 시 수습 상태가 종료되며, 실제 계약 해지는 HR 이 수동으로 진행해요.</p>
                </div>

                <Button className="w-full" onClick={() => void handleSubmit()} disabled={saving}>
                  제출
                </Button>
              </section>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
