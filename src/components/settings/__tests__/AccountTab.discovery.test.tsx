import { fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  disconnect: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  invalidateQueries: vi.fn(),
  rpc: vi.fn(),
  refetchCount: vi.fn(),
  identityAliasesResult: {} as Record<string, unknown>,
  eventCountResult: {} as Record<string, unknown>,
  disconnectMutationConfig: undefined as
    | {
        mutationFn: (aliasId: string) => Promise<unknown>
        onSettled: () => void
      }
    | undefined,
}))

vi.mock('sonner', () => ({
  toast: { error: mocks.toastError, success: mocks.toastSuccess },
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
  useIdentityAliases: () => mocks.identityAliasesResult,
}))
vi.mock('@/hooks/useEventDiscovery', () => ({
  useEventDiscoveryCount: () => mocks.eventCountResult,
}))

import AccountTab from '../AccountTab'

describe('Account settings discovery surface', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.disconnectMutationConfig = undefined
    mocks.identityAliasesResult = {
      verifiedEmails: [
        {
          id: 'alias-1',
          value: 'alias@example.com',
          verified: true,
          verified_at: '2026-09-02',
        },
        {
          id: 'alias-2',
          value: 'other@example.com',
          verified: true,
          verified_at: '2026-09-03',
        },
      ],
      requestVerification: vi.fn(),
      isRequesting: false,
      confirmVerification: vi.fn(),
      isConfirming: false,
      disconnectVerifiedEmail: mocks.disconnect,
      isDisconnecting: false,
      disconnectingAliasId: null,
    }
    mocks.eventCountResult = {
      data: 7,
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: mocks.refetchCount,
    }
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

  it('persistently reports discovered events and links to Events', () => {
    render(<MemoryRouter><AccountTab /></MemoryRouter>)
    expect(screen.getByText('We found 7 events')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View events' })).toHaveAttribute('href', '/events')
  })

  it('keeps the zero result actionable without flashing it during loading', () => {
    mocks.eventCountResult = {
      data: undefined,
      isLoading: true,
      isError: false,
      isFetching: true,
      refetch: mocks.refetchCount,
    }
    const { unmount } = render(<MemoryRouter><AccountTab /></MemoryRouter>)
    expect(screen.queryByText('We found 0 events')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Checking for matching events')).toBeInTheDocument()
    unmount()

    mocks.eventCountResult = {
      data: 0,
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: mocks.refetchCount,
    }
    render(<MemoryRouter><AccountTab /></MemoryRouter>)
    expect(screen.getByText('We found 0 events')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View events' })).toHaveAttribute('href', '/events')
  })

  it('leaves verified-email management usable when the count fails', () => {
    mocks.eventCountResult = {
      data: undefined,
      isLoading: false,
      isError: true,
      isFetching: false,
      refetch: mocks.refetchCount,
    }
    render(<MemoryRouter><AccountTab /></MemoryRouter>)

    expect(screen.getByText("We couldn't check for matching events.")).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(mocks.refetchCount).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Disconnect alias@example.com' })).toBeEnabled()
  })

  it('requires exact confirmation before disconnecting a non-primary verified email', async () => {
    mocks.disconnect.mockResolvedValue({ status: 'disconnected' })
    render(<MemoryRouter><AccountTab /></MemoryRouter>)

    fireEvent.click(screen.getByRole('button', { name: 'Disconnect alias@example.com' }))
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Disconnect alias@example.com?')
    expect(screen.getByRole('alertdialog')).toHaveTextContent(
      'Events connected only through this email will no longer appear, and future matches will stop. Original participant records will not be changed.',
    )
    expect(screen.getByRole('button', { name: 'Keep email connected' })).toBeInTheDocument()
    expect(mocks.disconnect).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect email' }))
    await waitFor(() => expect(mocks.disconnect).toHaveBeenCalledWith('alias-1'))
    expect(mocks.toastSuccess).toHaveBeenCalledWith('alias@example.com disconnected.')
    expect(screen.queryByRole('button', { name: 'Disconnect primary@example.com' })).not.toBeInTheDocument()
  })

  it('announces a safe unchanged-state failure and keeps the dialog available', async () => {
    mocks.disconnect.mockRejectedValue(new Error('private backend detail'))
    render(<MemoryRouter><AccountTab /></MemoryRouter>)

    fireEvent.click(screen.getByRole('button', { name: 'Disconnect alias@example.com' }))
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect email' }))

    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Couldn't disconnect this email. Nothing changed. Try again.",
      )
    })
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(screen.queryByText('private backend detail')).not.toBeInTheDocument()
  })

  it('disables only the alias whose disconnect is pending', () => {
    mocks.identityAliasesResult = {
      ...mocks.identityAliasesResult,
      isDisconnecting: true,
      disconnectingAliasId: 'alias-1',
    }
    render(<MemoryRouter><AccountTab /></MemoryRouter>)

    expect(screen.getByRole('button', { name: 'Disconnect alias@example.com' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Disconnect other@example.com' })).toBeEnabled()
  })
})
