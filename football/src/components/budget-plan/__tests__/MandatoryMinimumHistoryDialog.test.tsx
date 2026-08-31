/**
 * MandatoryMinimumHistoryDialog unit tests (issue #453 F4).
 *
 * Runner: vitest + @testing-library/react. tsconfig.app.json 이 __tests__ 를
 * exclude 하므로 프로덕션 typecheck 는 깨지 않는다. FE 러너가 도입되면 그대로
 * 통과하도록 표준 API 만 사용.
 *
 * 검증 항목 (issue #453 Acceptance 매핑):
 *   1) 이력 timeline 렌더 (3+ entries mixed status).
 *   2) 각 status pill 4 종 (PENDING/APPROVED/REJECTED/CANCELED) 색상 구분.
 *   3) 빈 이력 렌더.
 *   4) 로딩 상태.
 *   5) 에러 상태.
 *   6) evidenceUrl 링크 렌더 (있으면).
 *   7) reviewedBy/reviewNote 렌더 (있으면).
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MandatoryMinimumHistoryDialog } from '../MandatoryMinimumHistoryDialog'
import type {
  MandatoryMinimumChangeLogDto,
  MinimumChangeStatus,
} from '@/services/mandatory-minimum.service'

// ---------------------------------------------------------------------------
// Mocks — useMinimumHistory 만 스텁. 서비스 파일의 타입은 살려두고 훅만 교체.
// ---------------------------------------------------------------------------
type QueryResult = {
  data: MandatoryMinimumChangeLogDto[] | undefined
  isLoading: boolean
  isError: boolean
}

const historyMock: QueryResult = {
  data: undefined,
  isLoading: false,
  isError: false,
}

vi.mock('@/services/mandatory-minimum.service', async () => {
  const actual = await vi.importActual<Record<string, unknown>>(
    '@/services/mandatory-minimum.service',
  )
  return {
    ...actual,
    useMinimumHistory: () => historyMock,
  }
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeLog(
  over: Partial<MandatoryMinimumChangeLogDto> = {},
): MandatoryMinimumChangeLogDto {
  return {
    id: 1,
    categoryPlanId: 100,
    previousAmount: 1_000_000,
    newAmount: 1_500_000,
    evidenceType: 'CONTRACT',
    evidenceUrl: null,
    reason: '기본 사유',
    effectiveDate: '2026-09-01T00:00:00.000Z',
    status: 'PENDING',
    proposedById: 42,
    proposedAt: '2026-08-01T10:30:00.000Z',
    reviewedById: null,
    reviewedAt: null,
    reviewNote: null,
    proposedBy: {
      id: 42,
      email: 'fm@example.com',
      username: 'fm-user',
    },
    ...over,
  }
}

function renderDialog() {
  return render(
    <MandatoryMinimumHistoryDialog
      categoryPlanId={100}
      categoryLabel="선수 급여"
      trigger={<button data-testid="my-trigger">이력 보기</button>}
    />,
  )
}

function openDialog() {
  fireEvent.click(screen.getByTestId('mm-history-trigger'))
}

beforeEach(() => {
  historyMock.data = undefined
  historyMock.isLoading = false
  historyMock.isError = false
})

// ---------------------------------------------------------------------------
// (1) trigger → dialog 오픈 + 카테고리 라벨 렌더
// ---------------------------------------------------------------------------
describe('MandatoryMinimumHistoryDialog — 트리거 & 오픈', () => {
  it('trigger 클릭 시 dialog 가 렌더된다', () => {
    renderDialog()
    expect(screen.queryByTestId('mm-history-dialog')).toBeNull()

    openDialog()

    expect(screen.getByTestId('mm-history-dialog')).toBeTruthy()
    // 카테고리 라벨을 header 에 포함
    expect(screen.getByText(/선수 급여/)).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// (2) 로딩 상태
// ---------------------------------------------------------------------------
describe('MandatoryMinimumHistoryDialog — 로딩', () => {
  it('isLoading true 이면 Skeleton 이 렌더된다', () => {
    historyMock.isLoading = true
    renderDialog()
    openDialog()
    expect(screen.getByTestId('mm-history-loading')).toBeTruthy()
    // 이력 timeline entry 는 아직 없음
    expect(screen.queryByTestId('mm-history-empty')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// (3) 에러 상태
// ---------------------------------------------------------------------------
describe('MandatoryMinimumHistoryDialog — 에러', () => {
  it('isError true 이면 에러 문구 노출', () => {
    historyMock.isError = true
    renderDialog()
    openDialog()
    expect(screen.getByTestId('mm-history-error')).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// (4) 빈 이력
// ---------------------------------------------------------------------------
describe('MandatoryMinimumHistoryDialog — 빈 이력', () => {
  it('data=[] 이면 empty state 렌더', () => {
    historyMock.data = []
    renderDialog()
    openDialog()
    expect(screen.getByTestId('mm-history-empty')).toBeTruthy()
    expect(screen.getByText('변경 이력이 없습니다.')).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// (5) Timeline 렌더 — 3+ entries mixed status
// ---------------------------------------------------------------------------
describe('MandatoryMinimumHistoryDialog — Timeline 렌더', () => {
  const mixedLogs: MandatoryMinimumChangeLogDto[] = [
    makeLog({
      id: 10,
      status: 'PENDING',
      previousAmount: 2_000_000,
      newAmount: 3_000_000,
      evidenceType: 'CONTRACT',
      evidenceUrl: 'https://example.com/contract.pdf',
      reason: '주장 재계약',
      proposedAt: '2026-08-30T12:00:00.000Z',
    }),
    makeLog({
      id: 11,
      status: 'APPROVED',
      previousAmount: 1_500_000,
      newAmount: 2_000_000,
      evidenceType: 'LEGAL',
      reason: '법정 최저임금 인상',
      reviewedById: 99,
      reviewedAt: '2026-08-15T14:00:00.000Z',
      reviewedBy: {
        id: 99,
        email: 'gm@example.com',
        username: 'gm-user',
      },
      reviewNote: '적정 반영',
    }),
    makeLog({
      id: 12,
      status: 'REJECTED',
      previousAmount: 1_800_000,
      newAmount: 900_000,
      evidenceType: 'FIXED_COST',
      reason: '요청 하향',
      reviewedById: 99,
      reviewedAt: '2026-07-20T09:00:00.000Z',
      reviewedBy: { id: 99, email: 'gm@example.com', username: 'gm-user' },
      reviewNote: '증빙 부족',
    }),
    makeLog({
      id: 13,
      status: 'CANCELED',
      previousAmount: 1_500_000,
      newAmount: 1_600_000,
      evidenceType: 'FIXED_COST',
      reason: '오래된 제안',
      proposedAt: '2026-07-01T09:00:00.000Z',
    }),
  ]

  it('각 status pill 4 종이 render + data-status 로 구분된다', () => {
    historyMock.data = mixedLogs
    renderDialog()
    openDialog()

    // Timeline entries
    expect(screen.getByTestId('mm-history-entry-10')).toBeTruthy()
    expect(screen.getByTestId('mm-history-entry-11')).toBeTruthy()
    expect(screen.getByTestId('mm-history-entry-12')).toBeTruthy()
    expect(screen.getByTestId('mm-history-entry-13')).toBeTruthy()

    // Status pills — 각각 data-status 로 구분되고 서로 다른 className 을 가진다.
    const statuses: MinimumChangeStatus[] = [
      'PENDING',
      'APPROVED',
      'REJECTED',
      'CANCELED',
    ]
    const seen = new Set<string>()
    for (const s of statuses) {
      const pill = screen.getByTestId(`mm-history-status-${s}`)
      expect(pill).toBeTruthy()
      const classes = (pill as HTMLElement).className
      seen.add(classes)
    }
    // 4 개 status 모두 서로 다른 className 을 가진다 (색상 구분 확인).
    expect(seen.size).toBe(4)
  })

  it('evidenceUrl 이 있으면 external link 를 렌더한다', () => {
    historyMock.data = [mixedLogs[0]!]
    renderDialog()
    openDialog()
    const link = screen.getByTestId('mm-history-evidence-url') as HTMLAnchorElement
    expect(link).toBeTruthy()
    expect(link.href).toBe('https://example.com/contract.pdf')
    expect(link.target).toBe('_blank')
  })

  it('evidenceUrl 이 null 이면 링크가 렌더되지 않는다', () => {
    historyMock.data = [makeLog({ evidenceUrl: null })]
    renderDialog()
    openDialog()
    expect(screen.queryByTestId('mm-history-evidence-url')).toBeNull()
  })

  it('reviewedBy/reviewNote 가 있으면 함께 렌더한다', () => {
    historyMock.data = [mixedLogs[1]!]
    renderDialog()
    openDialog()
    expect(screen.getByTestId('mm-history-reviewed-by')).toBeTruthy()
    const note = screen.getByTestId('mm-history-review-note')
    expect(note.textContent).toContain('적정 반영')
  })

  it('reviewedBy 가 없으면 심사 정보 라인이 렌더되지 않는다', () => {
    historyMock.data = [makeLog({ reviewedById: null, reviewedAt: null })]
    renderDialog()
    openDialog()
    expect(screen.queryByTestId('mm-history-reviewed-by')).toBeNull()
    expect(screen.queryByTestId('mm-history-review-note')).toBeNull()
  })

  it('delta 는 증가/감소/동일에 따라 부호가 다르게 표시된다', () => {
    historyMock.data = [
      makeLog({ id: 20, previousAmount: 1_000_000, newAmount: 2_000_000 }),
      makeLog({ id: 21, previousAmount: 2_000_000, newAmount: 1_500_000 }),
      makeLog({ id: 22, previousAmount: 1_000_000, newAmount: 1_000_000 }),
    ]
    renderDialog()
    openDialog()
    const deltas = screen.getAllByTestId('mm-history-delta')
    expect(deltas.length).toBe(3)
    // 첫 번째: 증가 (+)
    expect(deltas[0]!.textContent!.trim().startsWith('+')).toBe(true)
    // 두 번째: 감소 (-)
    expect(deltas[1]!.textContent!.trim().startsWith('-')).toBe(true)
    // 세 번째: 동일 (±)
    expect(deltas[2]!.textContent!.trim().startsWith('±')).toBe(true)
  })
})
