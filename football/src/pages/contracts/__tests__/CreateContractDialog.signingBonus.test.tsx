import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('@/i18n', () => ({ default: { language: 'ko', t: (k: string) => k, on: vi.fn(), off: vi.fn() } }))
vi.mock('@/services/contract.service', () => ({
  contractApi: { create: vi.fn().mockResolvedValue({}) },
}))
vi.mock('@/hooks/usePlayers', () => ({
  usePlayers: () => ({ players: [], loading: false }),
}))
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: null }),
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))

// eslint-disable-next-line import/first
import { CreateContractDialog } from '../ContractsPage'

const defaultProps = {
  open: true,
  onOpenChange: vi.fn(),
  playerId: 'p1',
  onSaved: vi.fn(),
}

describe('CreateContractDialog — signingBonus', () => {
  it('renders signingBonus input field', () => {
    render(<CreateContractDialog {...defaultProps} />)
    expect(screen.getByTestId('signingBonus-input')).toBeTruthy()
  })

  it('shows amortize preview when signingBonus > 0 and dates are set', () => {
    render(<CreateContractDialog {...defaultProps} />)
    fireEvent.change(screen.getByTestId('startDate-input'), { target: { value: '2024-01-01' } })
    fireEvent.change(screen.getByTestId('endDate-input'), { target: { value: '2026-12-31' } })
    fireEvent.change(screen.getByTestId('signingBonus-input'), { target: { value: '90000000' } })
    expect(screen.getByTestId('signingBonus-preview')).toBeTruthy()
  })

  it('hides amortize preview when signingBonus is 0', () => {
    render(<CreateContractDialog {...defaultProps} />)
    fireEvent.change(screen.getByTestId('startDate-input'), { target: { value: '2024-01-01' } })
    fireEvent.change(screen.getByTestId('endDate-input'), { target: { value: '2026-12-31' } })
    expect(screen.queryByTestId('signingBonus-preview')).toBeNull()
  })
})
