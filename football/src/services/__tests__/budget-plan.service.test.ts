/**
 * budget-plan.service 단위 테스트.
 *
 * Runner: vitest (표준 Vite 조합). football/package.json 에 아직 test runner 가
 * 설치되어 있지 않다 — FE 전반적으로 unit test 인프라가 없는 상태. 러너가
 * 도입되면 이 파일이 그대로 통과하도록 표준 API 만 사용했다.
 *
 * tsc --noEmit 은 tsconfig.app.json 에서 __tests__ 를 exclude 하므로
 * 이 파일의 미설치 import 는 프로덕션 typecheck 를 깨지 않는다.
 *
 * services/api.ts 가 axios 가 아닌 fetch 를 쓰므로 axios 대신 global.fetch 를 mock 한다.
 * 스펙 상 "axios mock" 이라 명시돼 있었지만 실제 서비스 레이어가 fetch 라 fetch mock
 * 이 유일한 정답이다 — 이는 코드 상 사실이며 스펙 대비 명백한 deviation.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { budgetPlanApi } from '../budget-plan.service'
import type { PlanRequestLineDraft } from '@/components/budget-plan/types'

interface MockResponseInit {
  status?: number
  body?: unknown
}

function jsonResponse({ status = 200, body }: MockResponseInit): Response {
  const init: ResponseInit = {
    status,
    headers: { 'Content-Type': 'application/json' },
  }
  const payload = body === undefined ? '' : JSON.stringify(body)
  // status 204 는 body 없이 반환
  if (status === 204) {
    return new Response(null, init)
  }
  return new Response(payload, init)
}

/**
 * fetch spy. 각 테스트에서 mockResolvedValueOnce 로 응답을 주입한다.
 * i18n 도 CI 에서 사용 가능하도록 실제 인스턴스를 그대로 쓴다 —
 * api.ts 의 error path 만 i18n 을 참조하며 429/500 은 이번 테스트에 없다.
 */
let fetchSpy: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchSpy = vi.fn()
  vi.stubGlobal('fetch', fetchSpy)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('budgetPlanApi.openReview', () => {
  it('POST /financial-reports/:seasonId/open-review 로 빈 body 를 보내고 204 를 그대로 소비한다', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ status: 204 }))

    const result = await budgetPlanApi.openReview(42)

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('/api/financial-reports/42/open-review')
    expect((init as RequestInit).method).toBe('POST')
    expect((init as RequestInit).body).toBe('{}')
    // 204 → undefined 반환 (api.ts request() 규약)
    expect(result).toBeUndefined()
  })
})

describe('budgetPlanApi.submitPlanRequest', () => {
  it('draft.lines 를 wire shape (숫자 delta) 로 변환해 서버에 보낸다', async () => {
    const created = {
      id: 7,
      financialReportId: 3,
      requestedById: 100,
      scope: 'TEAM' as const,
      ownerType: 'TEAM',
      ownerId: 5,
      status: 'SUBMITTED' as const,
      submittedAt: '2026-08-29T00:00:00.000Z',
      processedAt: null,
      createdAt: '2026-08-29T00:00:00.000Z',
      updatedAt: '2026-08-29T00:00:00.000Z',
      lines: [],
    }
    fetchSpy.mockResolvedValueOnce(jsonResponse({ status: 201, body: created }))

    const drafts: PlanRequestLineDraft[] = [
      {
        categoryId: 11,
        triggers: ['HOME_MATCH', 'WEEKEND_OVERTIME'],
        standardDelta: '1000',
        premiumDelta: '2500',
        comment: 'season prep',
      },
      {
        // 빈 문자열은 0 으로 강제되어야 함 (draftLineToWire)
        categoryId: 12,
        triggers: [],
        standardDelta: '',
        premiumDelta: '',
      },
    ]

    const result = await budgetPlanApi.submitPlanRequest(3, drafts)

    expect(result).toEqual(created)
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('/api/financial-reports/3/plan-requests')
    const sent = JSON.parse((init as RequestInit).body as string) as {
      lines: Array<{
        categoryId: number
        triggers: string[]
        standardDelta: number
        premiumDelta: number
        comment?: string
        evidenceUrl?: string
      }>
    }
    expect(sent.lines).toEqual([
      {
        categoryId: 11,
        triggers: ['HOME_MATCH', 'WEEKEND_OVERTIME'],
        standardDelta: 1000,
        premiumDelta: 2500,
        comment: 'season prep',
      },
      {
        categoryId: 12,
        triggers: [],
        standardDelta: 0,
        premiumDelta: 0,
      },
    ])
  })
})

describe('budgetPlanApi.listPlanRequests', () => {
  it('GET /financial-reports/:seasonId/plan-requests 응답을 그대로 반환한다', async () => {
    const rows = [
      {
        id: 1,
        financialReportId: 3,
        requestedById: 100,
        scope: 'TEAM',
        ownerType: 'TEAM',
        ownerId: 5,
        status: 'SUBMITTED',
        submittedAt: '2026-08-29T00:00:00.000Z',
        processedAt: null,
        createdAt: '2026-08-29T00:00:00.000Z',
        updatedAt: '2026-08-29T00:00:00.000Z',
        lines: [],
      },
    ]
    fetchSpy.mockResolvedValueOnce(jsonResponse({ status: 200, body: rows }))

    const result = await budgetPlanApi.listPlanRequests(3)

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('/api/financial-reports/3/plan-requests')
    expect((init as RequestInit).method).toBe('GET')
    expect(result).toEqual(rows)
  })
})

describe('budgetPlanApi.requestOverride', () => {
  it('서버가 409 (OVERRIDE_EXCEEDS_TOTAL_BUDGET) 로 응답하면 code 를 그대로 throw 한다', async () => {
    // api.ts request() 규약: !res.ok → JSON 을 파싱해 { code, message } 중 하나로 Error 를 던짐
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({ status: 409, body: { code: 'OVERRIDE_EXCEEDS_TOTAL_BUDGET' } }),
    )

    await expect(
      budgetPlanApi.requestOverride(3, {
        categoryId: 11,
        amount: 999_999_999,
        reason: 'stadium repair',
      }),
    ).rejects.toThrow('OVERRIDE_EXCEEDS_TOTAL_BUDGET')

    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('/api/financial-reports/3/override-request')
    expect((init as RequestInit).method).toBe('POST')
  })
})

// #444: BudgetOverrideLog 목록 조회 wire test
describe('budgetPlanApi.listOverrideLogs (#444)', () => {
  it('query 인자 없이 호출 시 base URL 만 사용한다', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ status: 200, body: [] }))
    const result = await budgetPlanApi.listOverrideLogs(7)
    expect(result).toEqual([])
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('/api/financial-reports/7/override-logs')
    expect((init as RequestInit).method).toBe('GET')
  })

  it('status=PENDING → ?status=PENDING 를 붙인다', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ status: 200, body: [] }))
    await budgetPlanApi.listOverrideLogs(7, { status: 'PENDING' })
    const [url] = fetchSpy.mock.calls[0]
    expect(url).toBe('/api/financial-reports/7/override-logs?status=PENDING')
  })

  it('status + limit + cursor 조합 → 모두 query 로 직렬화된다', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ status: 200, body: [] }))
    await budgetPlanApi.listOverrideLogs(7, {
      status: 'PENDING',
      limit: 25,
      cursor: 100,
    })
    const [url] = fetchSpy.mock.calls[0]
    expect(url).toBe(
      '/api/financial-reports/7/override-logs?status=PENDING&limit=25&cursor=100',
    )
  })

  it('응답 body 를 그대로 반환한다 (createdBy/reviewedBy include 포함)', async () => {
    const rows = [
      {
        id: 42,
        financialReportId: 100,
        categoryId: 11,
        amount: 500_000,
        reason: '월드컵 준비',
        status: 'PENDING',
        createdById: 88,
        createdAt: '2026-08-29T10:00:00.000Z',
        reviewedById: null,
        reviewedAt: null,
        reviewNote: null,
        expenseCategory: { id: 11, code: 'utilities', label: '공공요금' },
        createdBy: {
          id: 88,
          email: 'leader@x.com',
          username: 'leader',
          frontOfficeRole: null,
        },
        reviewedBy: null,
      },
    ]
    fetchSpy.mockResolvedValueOnce(jsonResponse({ status: 200, body: rows }))
    const result = await budgetPlanApi.listOverrideLogs(7, { status: 'PENDING' })
    expect(result).toEqual(rows)
  })
})
