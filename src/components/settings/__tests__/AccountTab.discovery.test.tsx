import { fireEvent, render, renderHook, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  disconnect: vi.fn(),
  invalidateQueries: vi.fn(),
  rpc: vi.fn(),
  navigate: vi.fn(),
  disconnectMutationConfig: undefined as
    | {
        mutationFn: (aliasId: string) => Promise<unknown>
        onSettled: () => void
      }
    | undefined,
}))

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
  useQuery: () => ({ data: [], isLoading: false, error: null }),
  useMutation: (config: {
    mutationKey?: readonly string[]
    mutationFn: (input: unknown) => Promise<unknown>
    onSettled?: () => void
  }) => {
    if (config.mutationKey?.includes('disconnect-verified-email')) {
      mocks.disconnectMutationConfig = config as typeof mocks.disconnectMutationConfig
    }
    return {
      mutateAsync: config.mutationFn,
      isPending: false,
      variables: undefined,
    }
  },
}))

vi.mock('@/lib/auth-utils', () => ({
  getSafeUser: vi.fn(async () => ({
    user: { id: 'user-1', email: 'primary@example.com', user_metadata: {} },
    error: null,
  })),
}))
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: mocks.rpc,
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
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.disconnectMutationConfig = undefined
  })

  it('disconnects by opaque alias id and fails closed through IdentityAliasError', async () => {
    const service = await vi.importActual<
      typeof import('@/services/identity-alias.service')
    >('@/services/identity-alias.service')

    mocks.rpc.mockResolvedValueOnce({ data: true, error: null })
    await expect(
      service.disconnectVerifiedEmailAlias('11111111-1111-4111-8111-111111111111'),
    ).resolves.toEqual({ status: 'disconnected' })
    expect(mocks.rpc).toHaveBeenCalledWith('disconnect_my_verified_email_alias', {
      p_alias_id: '11111111-1111-4111-8111-111111111111',
    })

    mocks.rpc.mockResolvedValueOnce({ data: false, error: null })
    await expect(
      service.disconnectVerifiedEmailAlias('22222222-2222-4222-8222-222222222222'),
    ).rejects.toMatchObject({
      name: 'IdentityAliasError',
      code: 'DISCONNECT_FAILED',
    })
  })

  it('invalidates every authorization-sensitive cache after disconnect settles', async () => {
    const { useIdentityAliases } = await vi.importActual<
      typeof import('@/hooks/useIdentityAliases')
    >('@/hooks/useIdentityAliases')

    renderHook(() => useIdentityAliases())
    expect(mocks.disconnectMutationConfig).toBeDefined()
    mocks.disconnectMutationConfig?.onSettled()

    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['identity-aliases', 'verified-emails'],
    })
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['eventDiscovery'] })
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['notifications'] })
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['access-policy'] })
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['calls'] })
  })

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
