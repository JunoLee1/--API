import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { employeeContractApi } from '@/services/employee-contract.service'
import {
  EMPLOYEE_CONTRACT_STATUS_LABEL,
  EMPLOYEE_CONTRACT_STATUS_STYLE,
  type EmployeeContract,
} from '@/types/employee-contract'
import { CancelContractDialog } from './CancelContractDialog'
import { IssueContractDialog } from './IssueContractDialog'
import { SignContractDialog } from './SignContractDialog'
import { messageForContractCode } from './employee-contract.messages'

interface Props {
  /** HiringDispatch this contract section belongs to. */
  dispatchId: number
  /**
   * Optional callback fired whenever the "current" (latest active, i.e.
   * non-CANCELLED) contract row changes — parents can use this to refresh
   * the EXECUTION button's disabled state without re-fetching.
   */
  onCurrentChange?: (current: EmployeeContract | null) => void
  /**
   * When true the section is read-only (audit trail only, no action buttons).
   * Useful for pages that need to display contract state to non-HR roles.
   */
  readOnly?: boolean
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function fmtDate(iso: string | null): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('ko-KR')
}

/**
 * 근로계약 관리 섹션. HiringDispatch 상세 화면에 임베드.
 *
 * 렌더링:
 *  - 최신 non-CANCELLED 계약 상태 배지 + 감사 정보
 *  - 원본 / 서명본 다운로드 링크
 *  - 상태별 액션 버튼 (없음/DRAFT/ISSUED/SIGNED/CANCELLED)
 *  - 이력 (append-only, 오래된 CANCELLED 포함)
 *
 * 액션은 3개 다이얼로그로 위임 — Issue / Sign / Cancel. 각 다이얼로그가
 * 성공 시 부모(이 컴포넌트)에게 갱신된 row 를 콜백으로 넘겨주므로
 * 재조회 없이 즉시 반영된다.
 */
export function EmployeeContractSection({
  dispatchId,
  onCurrentChange,
  readOnly = false,
}: Props) {
  const [rows, setRows] = useState<EmployeeContract[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)

  const [issueId, setIssueId] = useState<number | null>(null)
  const [signId, setSignId] = useState<number | null>(null)
  const [cancelId, setCancelId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const list = await employeeContractApi.listByDispatch(dispatchId)
      setRows(list)
    } catch (err) {
      const code = err instanceof Error ? err.message : ''
      toast.error(messageForContractCode(code, '계약 정보를 불러오지 못했습니다.'))
    } finally {
      setLoading(false)
    }
  }, [dispatchId])

  useEffect(() => {
    void load()
  }, [load])

  // "Current" = latest non-CANCELLED. Kept in sync with the server-side
  // gate (`findLatestActiveByDispatch`) so the FE badge always matches
  // what dispatch() would see.
  const current = useMemo(() => {
    if (!rows) return null
    return rows.find((r) => r.status !== 'CANCELLED') ?? null
  }, [rows])

  useEffect(() => {
    onCurrentChange?.(current)
  }, [current, onCurrentChange])

  const upsertRow = useCallback((updated: EmployeeContract) => {
    setRows((prev) => {
      if (!prev) return [updated]
      const next = prev.map((r) => (r.id === updated.id ? updated : r))
      // If the updated row wasn't in the list (rare — happens on race
      // conditions), prepend it so the newest state is always visible.
      if (!next.some((r) => r.id === updated.id)) return [updated, ...next]
      return next
    })
  }, [])

  const createNewDraft = async () => {
    setCreating(true)
    try {
      const created = await employeeContractApi.create(dispatchId)
      setRows((prev) => (prev ? [created, ...prev] : [created]))
      toast.success('새 계약서 초안이 생성됐습니다. 이어서 계약서 파일을 업로드해주세요.')
      // Auto-open the issue dialog for the newly created draft so HR can
      // upload the file in one flow (Q4 spirit — minimize clicks).
      setIssueId(created.id)
    } catch (err) {
      const code = err instanceof Error ? err.message : ''
      toast.error(messageForContractCode(code, '계약서 초안 생성에 실패했습니다.'))
    } finally {
      setCreating(false)
    }
  }

  return (
    <section className="rounded-lg border p-4 space-y-4">
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-base font-semibold">근로계약</h3>
          <p className="text-xs text-muted-foreground">
            최신 계약이 서명 완료(SIGNED) 상태여야 발령 실행이 가능합니다.
          </p>
        </div>
        {current ? (
          <Badge
            variant="outline"
            className={EMPLOYEE_CONTRACT_STATUS_STYLE[current.status]}
          >
            {EMPLOYEE_CONTRACT_STATUS_LABEL[current.status]}
          </Badge>
        ) : (
          <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-200">
            미발행
          </Badge>
        )}
      </header>

      {loading && !rows ? (
        <Skeleton className="h-24 w-full" />
      ) : (
        <>
          {current ? (
            <CurrentContractCard
              row={current}
              readOnly={readOnly}
              onIssue={() => setIssueId(current.id)}
              onSign={() => setSignId(current.id)}
              onCancel={() => setCancelId(current.id)}
            />
          ) : (
            <div className="rounded border border-dashed p-4 text-sm text-muted-foreground">
              아직 발행된 계약서가 없습니다.
              {!readOnly && (
                <div className="mt-3">
                  <Button
                    size="sm"
                    onClick={() => void createNewDraft()}
                    disabled={creating}
                  >
                    계약서 발행 시작
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* CANCELLED-and-no-active → offer "new contract" too. */}
          {current == null && rows && rows.length > 0 && !readOnly && (
            <div className="text-xs text-muted-foreground">
              이전 계약이 모두 취소됐습니다. 새 계약서를 발행해주세요.
            </div>
          )}

          {rows && rows.length > 1 && <HistoryList rows={rows} />}
        </>
      )}

      <IssueContractDialog
        contractId={issueId}
        open={issueId !== null}
        onOpenChange={(o) => !o && setIssueId(null)}
        onSuccess={upsertRow}
      />
      <SignContractDialog
        contractId={signId}
        open={signId !== null}
        onOpenChange={(o) => !o && setSignId(null)}
        onSuccess={upsertRow}
      />
      <CancelContractDialog
        contractId={cancelId}
        open={cancelId !== null}
        onOpenChange={(o) => !o && setCancelId(null)}
        onSuccess={upsertRow}
      />
    </section>
  )
}

function CurrentContractCard({
  row,
  readOnly,
  onIssue,
  onSign,
  onCancel,
}: {
  row: EmployeeContract
  readOnly: boolean
  onIssue: () => void
  onSign: () => void
  onCancel: () => void
}) {
  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-muted-foreground">생성</dt>
          <dd>
            {row.createdBy.nickname} · {fmtDateTime(row.createdAt)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">발행</dt>
          <dd>
            {row.issuedBy
              ? `${row.issuedBy.nickname} · ${fmtDateTime(row.issuedAt)}`
              : '-'}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">서명 날짜</dt>
          <dd>{fmtDate(row.signedAt)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">서명 확인</dt>
          <dd>
            {row.signedConfirmedBy
              ? `${row.signedConfirmedBy.nickname} · ${fmtDateTime(row.signedConfirmedAt)}`
              : '-'}
          </dd>
        </div>
      </dl>

      <div className="flex flex-wrap gap-2 text-sm">
        {row.fileUrl && (
          <a
            href={row.fileUrl}
            target="_blank"
            rel="noreferrer"
            className="text-blue-600 hover:underline"
          >
            원본 계약서 다운로드
            {row.fileName ? ` (${row.fileName})` : ''}
          </a>
        )}
        {row.signedFileUrl && (
          <a
            href={row.signedFileUrl}
            target="_blank"
            rel="noreferrer"
            className="text-blue-600 hover:underline"
          >
            서명본 다운로드
            {row.signedFileName ? ` (${row.signedFileName})` : ''}
          </a>
        )}
      </div>

      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          {row.status === 'DRAFT' && (
            <Button size="sm" onClick={onIssue}>
              계약서 발행
            </Button>
          )}
          {row.status === 'ISSUED' && (
            <Button size="sm" onClick={onSign}>
              서명본 업로드
            </Button>
          )}
          {row.status !== 'CANCELLED' && (
            <Button size="sm" variant="destructive" onClick={onCancel}>
              계약서 취소
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

function HistoryList({ rows }: { rows: EmployeeContract[] }) {
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-muted-foreground">
        이전 계약 이력 ({rows.length}건)
      </summary>
      <ul className="mt-2 space-y-2">
        {rows.map((row) => (
          <li key={row.id} className="rounded border p-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-medium">계약 #{row.id}</span>
              <Badge
                variant="outline"
                className={EMPLOYEE_CONTRACT_STATUS_STYLE[row.status]}
              >
                {EMPLOYEE_CONTRACT_STATUS_LABEL[row.status]}
              </Badge>
            </div>
            <div className="mt-1 text-muted-foreground">
              생성 {fmtDateTime(row.createdAt)}
              {row.cancelledAt && (
                <>
                  {' · '}
                  취소 {fmtDateTime(row.cancelledAt)}
                  {row.cancelReason ? ` (${row.cancelReason})` : ''}
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </details>
  )
}
