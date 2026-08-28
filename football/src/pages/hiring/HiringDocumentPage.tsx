import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { hiringDispatchApi } from '@/services/hiring-dispatch.service'
import { hiringDocumentApi, type HiringDocTarget } from '@/services/hiring-document.service'
import { recruitmentApi } from '@/services/recruitment.service'
import {
  DOC_STATUS_COLOR,
  DOC_STATUS_LABEL,
  type DocumentSlot,
  type HiringDocument,
} from '@/types/hiring-document'
import { DocumentUploadDialog } from '@/components/hiring-document/DocumentUploadDialog'
import { DocumentReviewDialog } from '@/components/hiring-document/DocumentReviewDialog'

/**
 * URL parameters. This page handles two entry points so the BE dual-reference
 * shape (application XOR dispatch) is preserved on the FE:
 *   - /hiring/dispatches/:dispatchId/documents
 *   - /hiring/applications/:applicationId/documents
 * The route decides which via a query param `?kind=` or presence of the id
 * segment name. Keeping both in a single page avoids duplicating the "slots
 * derived from required" logic.
 */
export function HiringDocumentPage() {
  const params = useParams<{ dispatchId?: string; applicationId?: string }>()
  const [search] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useCurrentUser()

  const dispatchIdParam = params.dispatchId ?? (search.get('dispatchId') ?? undefined)
  const applicationIdParam = params.applicationId ?? (search.get('applicationId') ?? undefined)
  const dispatchId = dispatchIdParam ? Number(dispatchIdParam) : null
  const applicationId = applicationIdParam ? Number(applicationIdParam) : null

  const target: HiringDocTarget | null = useMemo(() => {
    if (dispatchId != null && Number.isFinite(dispatchId)) return { hiringDispatchId: dispatchId }
    if (applicationId != null && Number.isFinite(applicationId)) return { applicationId }
    return null
  }, [dispatchId, applicationId])

  const [requiredDocs, setRequiredDocs] = useState<string[]>([])
  const [documents, setDocuments] = useState<HiringDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewTarget, setReviewTarget] = useState<HiringDocument | null>(null)
  const [preselectedDocType, setPreselectedDocType] = useState<string | undefined>(undefined)

  const canWrite =
    user?.role === 'ADMIN' ||
    user?.role === 'GM' ||
    (user?.role === 'FRONT_OFFICE' && user.frontOfficeRole === 'HR_MANAGER')

  const load = useCallback(async () => {
    if (!target) return
    setLoading(true)
    try {
      // Required list: from posting (for application-anchored) or from
      // dispatch (application-free).
      let required: string[] = []
      if ('applicationId' in target && target.applicationId != null) {
        // Fetch application → posting.requiredDocuments
        const app = await recruitmentApi.getApplication(target.applicationId)
        const postingId = (app as any).posting?.id
        if (postingId) {
          const posting = await recruitmentApi.getPosting(postingId)
          required = (posting as any).requiredDocuments ?? []
        }
      } else if ('hiringDispatchId' in target && target.hiringDispatchId != null) {
        const disp = await hiringDispatchApi.get(target.hiringDispatchId)
        if (disp.applicationId != null && disp.application?.posting) {
          required = (disp.application.posting as any).requiredDocuments ?? []
        } else {
          required = (disp as any).requiredDocuments ?? []
        }
      }
      const docs = await hiringDocumentApi.listCurrent(target)
      setRequiredDocs(required)
      setDocuments(docs)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '로드 실패')
    } finally {
      setLoading(false)
    }
  }, [target])

  useEffect(() => {
    void load()
  }, [load])

  // Merge required + uploaded into a single slots array so the table can render
  // both "요구되지만 미제출", "요구되지 않지만 업로드된 추가 서류", and everything
  // in between in one pass.
  const slots: DocumentSlot[] = useMemo(() => {
    const byDocType = new Map<string, HiringDocument>()
    for (const d of documents) {
      if (!byDocType.has(d.docType)) byDocType.set(d.docType, d)
    }
    const required = requiredDocs.map((docType) => ({
      docType,
      isRequired: true,
      latest: byDocType.get(docType) ?? null,
    }))
    const extras: DocumentSlot[] = []
    for (const [docType, doc] of byDocType.entries()) {
      if (!requiredDocs.includes(docType)) {
        extras.push({ docType, isRequired: false, latest: doc })
      }
    }
    return [...required, ...extras]
  }, [requiredDocs, documents])

  const missingCount = slots.filter(
    (s) => s.isRequired && (s.latest == null || s.latest.status !== 'APPROVED'),
  ).length

  if (!target) {
    return <div className="p-6 text-sm text-destructive">잘못된 URL — id가 없습니다.</div>
  }
  if (loading) return <div className="p-6 text-sm text-muted-foreground">로딩 중...</div>

  const openUploadFor = (docType?: string) => {
    setPreselectedDocType(docType)
    setUploadOpen(true)
  }
  const openReviewFor = (doc: HiringDocument) => {
    setReviewTarget(doc)
    setReviewOpen(true)
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="space-y-1">
        <button
          onClick={() => navigate(-1)}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← 뒤로
        </button>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold">채용 서류 관리</h1>
          {missingCount > 0 && (
            <Badge variant="destructive">필수 미승인 {missingCount}건</Badge>
          )}
          {missingCount === 0 && requiredDocs.length > 0 && (
            <Badge variant="default">필수 서류 완료</Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {'applicationId' in target
            ? `지원자 #${target.applicationId} 서류`
            : `발령 #${target.hiringDispatchId} 서류 (Application-free)`}
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">서류 목록</CardTitle>
          {canWrite && (
            <Button variant="outline" size="sm" onClick={() => openUploadFor()}>
              추가 서류 업로드
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {slots.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              필수 서류가 지정되지 않았고 업로드된 서류도 없습니다.
            </div>
          ) : (
            slots.map((slot) => (
              <div
                key={`${slot.docType}-${slot.latest?.id ?? 'none'}`}
                className="flex items-center justify-between rounded-md border p-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{slot.docType}</span>
                    {slot.isRequired ? (
                      <Badge variant="outline">필수</Badge>
                    ) : (
                      <Badge variant="secondary">추가</Badge>
                    )}
                    {slot.latest ? (
                      <span
                        className={`rounded border px-2 py-0.5 text-xs ${DOC_STATUS_COLOR[slot.latest.status]}`}
                      >
                        {DOC_STATUS_LABEL[slot.latest.status]}
                      </span>
                    ) : (
                      <Badge variant="destructive">미제출</Badge>
                    )}
                  </div>
                  {slot.latest && (
                    <div className="text-xs text-muted-foreground">
                      {slot.latest.fileName ?? '(파일)'} · 업로드: {slot.latest.uploadedBy.nickname}
                      {slot.latest.reviewedBy &&
                        ` · 검토: ${slot.latest.reviewedBy.nickname}`}
                      {slot.latest.reviewNotes && (
                        <div className="mt-1 text-destructive">
                          사유: {slot.latest.reviewNotes}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  {slot.latest && (
                    <a
                      href={slot.latest.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-primary underline"
                    >
                      열기
                    </a>
                  )}
                  {canWrite && (!slot.latest || slot.latest.status === 'REJECTED') && (
                    <Button size="sm" variant="outline" onClick={() => openUploadFor(slot.docType)}>
                      {slot.latest?.status === 'REJECTED' ? '재업로드' : '업로드'}
                    </Button>
                  )}
                  {canWrite && slot.latest?.status === 'PENDING' && (
                    <Button size="sm" onClick={() => openReviewFor(slot.latest!)}>
                      검토
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <DocumentUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        target={target}
        suggestedDocTypes={requiredDocs}
        preselectedDocType={preselectedDocType}
        onUploaded={() => void load()}
      />
      <DocumentReviewDialog
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        document={reviewTarget}
        onReviewed={() => void load()}
      />
    </div>
  )
}
