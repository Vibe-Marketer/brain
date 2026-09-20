import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  disconnect: vi.fn(),
  navigate: vi.fn(),
}))

vi.mock('@/lib/auth-utils', () => ({
  getSafeUser: vi.fn(async () => ({
    user: { id: 'user-1', email: 'primary@example.com', user_metadata: {} },
    error: null,
  })),
}))
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
      update: () => ({ eq: async () => ({ error: null }) }),
    }),
    auth: { updateUser: vi.fn() },
  },
}))
vi.mock('@/stores/preferencesStore', () => ({
  usePreferencesStore: () => ({
    preferences: { timezone: 'America/New_York' },
    isLoading: false,
    loadPreferences: vi.fn(),
    updatePreference: vi.fn(),
  }),
}))
vi.mock('@/hooks/useIdentityAliases', () => ({
  useIdentityAliases: () => ({
    verifiedEmails: [
      { id: 'primary', email: 'primary@example.com', isPrimary: true, verifiedAt: '2026-09-01' },
      { id: 'alias-1', email: 'alias@example.com', isPrimary: false, verifiedAt: '2026-09-02' },
    ],
    requestVerification: vi.fn(),
    isRequesting: false,
    confirmVerification: vi.fn(),
    isConfirming: false,
  }),
}))
vi.mock('@/hooks/useEventDiscovery', () => ({
  useEventDiscoveryCount: () => ({ data: 7, isLoading: false, isError: false, refetch: vi.fn() }),
  useDisconnectVerifiedEmail: () => ({ mutateAsync: mocks.disconnect, isPending: false }),
}))

import AccountTab from '../AccountTab'

describe('Account settings discovery surface (Wave 0 RED)', () => {
  beforeEach(() => vi.clearAllMocks())

  it.fails('RED: persistently reports discovered events and links to Events', () => {
    render(<MemoryRouter><AccountTab /></MemoryRouter>)
    expect(screen.getByText('We found 7 events')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View events' })).toHaveAttribute('href', '/events')
  })

  it.fails('RED: requires confirmation before disconnecting a non-primary verified email', async () => {
    mocks.disconnect.mockResolvedValue({ status: 'disconnected' })
    render(<MemoryRouter><AccountTab /></MemoryRouter>)

    fireEvent.click(screen.getByRole('button', { name: /Disconnect alias@example.com/i }))
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Disconnect verified email?')
    expect(screen.getByRole('alertdialog')).toHaveTextContent(/removes event visibility.*stops future matching/i)
    expect(screen.getByRole('alertdialog')).toHaveTextContent(/participant records.*remain/i)
    expect(mocks.disconnect).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect email' }))
    expect(mocks.disconnect).toHaveBeenCalledWith('alias-1')
    expect(screen.queryByRole('button', { name: /Disconnect primary@example.com/i })).not.toBeInTheDocument()
  })
})
