import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

vi.mock('@/services/contract.service', () => ({
  contractApi: {
    get: vi.fn(),
    markSigningBonusPaid: vi.fn().mockResolvedValue({}),
  },
}))
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: { role: 'ADMIN', frontOfficeRole: null } }),
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { contractApi } from '@/services/contract.service'
import { ContractDetailPage } from '../ContractDetailPage'
import type { ContractDetail } from '@/types/contract'

function makeContract(overrides: Partial<ContractDetail> = {}): ContractDetail {
  return {
    id: 1,
    startDate: '2024-01-01T00:00:00.000Z',
    endDate: '2026-12-31T00:00:00.000Z',
    salary: 50_000_000,
    status: 'ACTIVE',
    managedById: null,
    playerId: 'p1',
    signingBonus: 10_000_000,
    signingBonusScheduledAt: '2024-02-01T00:00:00.000Z',
    signingBonusPaidAt: null,
    buyoutClause: null,
    extensionOptions: [],
    performanceBonuses: [],
    ...overrides,
  }
}

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <MemoryRouter initialEntries={['/contracts/1']}>
      <QueryClientProvider client={qc}>
        <Routes>
          <Route path="/contracts/:id" element={children} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.mocked(contractApi.get).mockResolvedValue(makeContract())
})

describe('ContractDetailPage — signing bonus card', () => {
  it('서명 보너스 카드가 signingBonus > 0 일 때 렌더된다', async () => {
    render(<ContractDetailPage />, { wrapper })
    await waitFor(() => expect(screen.getByTestId('signing-bonus-card')).toBeTruthy())
  })

  it('signingBonus === 0 이면 카드가 렌더되지 않는다', async () => {
    vi.mocked(contractApi.get).mockResolvedValue(makeContract({ signingBonus: 0 }))
    render(<ContractDetailPage />, { wrapper })
    await waitFor(() => expect(screen.queryByTestId('signing-bonus-card')).toBeNull())
  })

  it('미지급 상태에서 [지급 완료 처리] 버튼이 보인다', async () => {
    render(<ContractDetailPage />, { wrapper })
    await waitFor(() =>
      expect(screen.getByTestId('mark-paid-btn')).toBeTruthy()
    )
  })

  it('지급 완료 후 버튼이 사라지고 완료 날짜가 표시된다', async () => {
    vi.mocked(contractApi.get).mockResolvedValue(
      makeContract({ signingBonusPaidAt: '2024-02-01T00:00:00.000Z' })
    )
    render(<ContractDetailPage />, { wrapper })
    await waitFor(() => expect(screen.queryByTestId('mark-paid-btn')).toBeNull())
    expect(screen.getByTestId('paid-date')).toBeTruthy()
  })
})
