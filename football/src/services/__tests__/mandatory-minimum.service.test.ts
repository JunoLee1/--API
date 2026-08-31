/**
 * mandatory-minimum.service 단위 테스트.
 *
 * Runner: vitest (표준 Vite 조합). football/package.json 에 아직 test runner 가
 * 설치되어 있지 않다 — FE 전반적으로 unit test 인프라가 없는 상태.
 * budget-plan.service.test.ts 와 같은 패턴 (global fetch mock via vi.stubGlobal)
 * 을 사용해 러너가 도입되면 그대로 통과하도록 표준 API 만 사용했다.
 *
 * tsc --noEmit 은 tsconfig.app.json 에서 __tests__ 를 exclude 하므로 이 파일의
 * 미설치 import 는 프로덕션 typecheck 를 깨지 않는다.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  proposeMinimum,
  reviewMinimum,
  listHistory,
  type MandatoryMinimumChangeLogDto,
  type ProposeMinimumDto,
} from '../mandatory-minimum.service'

interface MockResponseInit {
  status?: number
  body?: unknown
}

function jsonResponse({ status = 200, body }: MockResponseInit): Response {
  const init: ResponseInit = {
    status,
    headers: { 'Content-Type': 'application/json' },
  }
  if (status === 204) {
    return new Response(null, init)
  }
  const payload = body === undefined ? '' : JSON.stringify(body)
  return new Response(payload, init)
}

let fetchSpy: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchSpy = vi.fn()
  vi.stubGlobal('fetch', fetchSpy)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// ============================================================================
// 픽스처
// ============================================================================

const baseLog: MandatoryMinimumChangeLogDto = {
  id: 501,
  categoryPlanId: 77,
  previousAmount: 1_000_000,
  newAmount: 1_500_000,
  evidenceType: 'CONTRACT',
  evidenceUrl: 'https://docs.example.com/salary-contract.pdf',
  reason: '연봉 인상 계약 갱신',
  effectiveDate: '2026-09-01',
  status: 'PENDING',
  proposedById: 100,
  proposedAt: '2026-08-31T10:00:00.000Z',
  reviewedById: null,
  reviewedAt: null,
  reviewNote: null,
  proposedBy: { id: 100, email: 'fm@club.com', username: 'FM Kim' },
  categoryPlan: {
    id: 77,
    mandatoryMinimum: 1_000_000,
    expenseCategory: { id: 11, code: 'SALARY', label: '급여' },
  },
}

// ============================================================================
// Tests
// ============================================================================

describe('proposeMinimum', () => {
  it('POST /budget-category-plans/:id/mandatory-minimum 로 dto 를 보내고 201 응답을 그대로 반환한다', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ status: 201, body: baseLog }))

    const dto: ProposeMinimumDto = {
      newAmount: 1_500_000,
      evidenceType: 'CONTRACT',
      evidenceUrl: 'https://docs.example.com/salary-contract.pdf',
      reason: '연봉 인상 계약 갱신',
      effectiveDate: '2026-09-01',
    }

    const result = await proposeMinimum(77, dto)

    expect(result).toEqual(baseLog)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('/api/budget-category-plans/77/mandatory-minimum')
    expect((init as RequestInit).method).toBe('POST')
    const sent = JSON.parse((init as RequestInit).body as string)
    expect(sent).toEqual(dto)
  })
})

describe('reviewMinimum', () => {
  it('APPROVED + note 를 그대로 payload 에 실어 서버로 보낸다', async () => {
    const approved: MandatoryMinimumChangeLogDto = {
      ...baseLog,
      status: 'APPROVED',
      reviewedById: 200,
      reviewedAt: '2026-08-31T11:00:00.000Z',
      reviewNote: '계약 확인 완료',
      reviewedBy: { id: 200, email: 'gm@club.com', username: 'GM Park' },
    }
    fetchSpy.mockResolvedValueOnce(jsonResponse({ status: 200, body: approved }))

    const result = await reviewMinimum(501, 'APPROVED', '계약 확인 완료')

    expect(result).toEqual(approved)
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('/api/mandatory-minimum-changes/501/review')
    expect((init as RequestInit).method).toBe('POST')
    const sent = JSON.parse((init as RequestInit).body as string)
    expect(sent).toEqual({ decision: 'APPROVED', note: '계약 확인 완료' })
  })

  it('note 가 undefined 이면 payload 에서 note 키를 생략한다', async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({ status: 200, body: { ...baseLog, status: 'APPROVED' } }),
    )

    await reviewMinimum(501, 'APPROVED')

    const [, init] = fetchSpy.mock.calls[0]
    const sent = JSON.parse((init as RequestInit).body as string) as Record<
      string,
      unknown
    >
    expect(sent).toEqual({ decision: 'APPROVED' })
    expect(Object.prototype.hasOwnProperty.call(sent, 'note')).toBe(false)
  })
})

describe('listHistory', () => {
  it('서버가 proposedAt DESC 순서로 반환하는 배열을 그대로 유지한다', async () => {
    // 서버는 orderBy proposedAt desc — 최신이 앞. 응답을 그대로 전달하는지만 검증.
    const rows: MandatoryMinimumChangeLogDto[] = [
      {
        ...baseLog,
        id: 503,
        proposedAt: '2026-08-31T12:00:00.000Z',
        status: 'PENDING',
      },
      {
        ...baseLog,
        id: 502,
        proposedAt: '2026-08-30T09:00:00.000Z',
        status: 'REJECTED',
        reviewedById: 200,
        reviewedAt: '2026-08-30T10:00:00.000Z',
        reviewNote: '근거 부족',
      },
      {
        ...baseLog,
        id: 501,
        proposedAt: '2026-08-29T09:00:00.000Z',
        status: 'CANCELED',
      },
    ]
    fetchSpy.mockResolvedValueOnce(jsonResponse({ status: 200, body: rows }))

    const result = await listHistory(77)

    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe(
      '/api/budget-category-plans/77/mandatory-minimum/history',
    )
    expect((init as RequestInit).method).toBe('GET')
    // 순서 보존 검증
    expect(result.map((r) => r.id)).toEqual([503, 502, 501])
    expect(result).toEqual(rows)
  })
})

describe('proposeMinimum error path', () => {
  it('서버가 409 (ALREADY_REVIEWED) 를 반환하면 code 를 그대로 throw 한다', async () => {
    // api.ts request() 규약: !res.ok → body.code (or body.message) 로 Error throw
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({ status: 409, body: { code: 'ALREADY_REVIEWED' } }),
    )

    await expect(
      proposeMinimum(77, {
        newAmount: 1_500_000,
        evidenceType: 'CONTRACT',
        evidenceUrl: 'https://docs.example.com/salary-contract.pdf',
        reason: '연봉 인상',
        effectiveDate: '2026-09-01',
      }),
    ).rejects.toThrow('ALREADY_REVIEWED')

    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('/api/budget-category-plans/77/mandatory-minimum')
    expect((init as RequestInit).method).toBe('POST')
  })
})
