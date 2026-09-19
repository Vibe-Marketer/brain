import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { PrivacyAccessSettings } from '@/components/settings/PrivacyAccessSettings'
import { SETTINGS_CATEGORIES } from '@/components/panes/SettingsCategoryPane'

const mocks = vi.hoisted(() => ({
  mutateDefault: vi.fn(),
  refetchDefault: vi.fn(),
  query: {
    data: { accessLevel: 'private' as const },
    isLoading: false,
    isError: false,
  },
  mutation: {
    isPending: false,
    variables: undefined as string | undefined,
  },
}))

vi.mock('@/hooks/useAccessPolicy', () => ({
  useAccountAccessDefault: () => ({
    ...mocks.query,
    refetch: mocks.refetchDefault,
  }),
  useSetAccountAccessDefault: () => ({
    mutate: mocks.mutateDefault,
    ...mocks.mutation,
  }),
}))

describe('PrivacyAccessSettings acceptance contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.query.data = { accessLevel: 'private' }
    mocks.query.isLoading = false
    mocks.query.isError = false
    mocks.mutation.isPending = false
    mocks.mutation.variables = undefined
  })

  it('renders the six-option future-only default and saves non-Public choices immediately', () => {
    render(<PrivacyAccessSettings />)

    expect(screen.getByRole('heading', { name: 'Privacy & Access' })).toBeInTheDocument()
    expect(screen.getByText('Choose how new recordings start.')).toBeInTheDocument()
    expect(screen.getByText('Default access for new recordings')).toBeInTheDocument()
    expect(screen.getByText("New recordings use this access level. Changing it won't update recordings you already have.")).toBeInTheDocument()
    const options = [
      ['Private', 'Only you and people you explicitly grant access to.'],
      ['Attendees', 'Confirmed meeting attendees can view the recording.'],
      ['Invitees', 'People invited to the meeting can view the recording.'],
      ['Organization', 'People in your organization can view the recording.'],
      ['Anyone with link', 'People with an active CallVault share link can view the recording.'],
      ['Public', 'Anyone can view the recording without an invitation or share link.'],
    ] as const
    for (const [name, description] of options) {
      expect(screen.getByRole('radio', { name: new RegExp(`^${name}`) })).toBeInTheDocument()
      expect(screen.getByText(description)).toBeInTheDocument()
    }
    expect(screen.getByRole('radiogroup', { name: 'Default access for new recordings' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('radio', { name: /^Attendees/ }))
    expect(mocks.mutateDefault).toHaveBeenCalledWith('attendees', expect.any(Object))
    expect(screen.queryByRole('button', { name: /^save$/i })).not.toBeInTheDocument()
  })

  it('confirms Public with a normal primary action and restores focus on cancel', async () => {
    render(<PrivacyAccessSettings />)
    const publicOption = screen.getByRole('radio', { name: /^Public/ })
    fireEvent.click(publicOption)

    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(screen.getByText('Make new recordings public by default?')).toBeInTheDocument()
    expect(screen.getByText('Every new recording will be publicly viewable unless you change its access level. Existing recordings will not change.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Use Public by default' })).not.toHaveClass('bg-destructive')
    fireEvent.click(screen.getByRole('button', { name: 'Keep current default' }))
    await waitFor(() => expect(publicOption).toHaveFocus())
    expect(mocks.mutateDefault).not.toHaveBeenCalled()
  })

  it('keeps the previous selection and exact rollback message when an optimistic save fails', () => {
    mocks.mutateDefault.mockImplementationOnce(
      (_level: string, callbacks: { onError?: () => void }) => callbacks.onError?.(),
    )
    render(<PrivacyAccessSettings />)
    fireEvent.click(screen.getByRole('radio', { name: /^Attendees/ }))
    expect(screen.getByRole('radio', { name: /^Private/ })).toBeChecked()
    expect(screen.getByText("Couldn't update the default. Your previous setting is still active. Try again.")).toBeInTheDocument()
  })

  it('shows matching skeleton rows without flashing Private while loading', () => {
    mocks.query.isLoading = true
    render(<PrivacyAccessSettings />)

    expect(screen.getByLabelText('Loading default access setting')).toBeInTheDocument()
    expect(screen.queryByRole('radio', { name: /^Private/ })).not.toBeInTheDocument()
  })

  it('disables only the radio group and marks the pending choice while saving', () => {
    mocks.mutation.isPending = true
    mocks.mutation.variables = 'attendees'
    render(<PrivacyAccessSettings />)

    expect(screen.getByRole('radiogroup')).toHaveAttribute('data-disabled')
    expect(screen.getByLabelText('Saving Attendees')).toBeInTheDocument()
  })

  it('offers a retry when the default cannot be loaded', () => {
    mocks.query.isError = true
    render(<PrivacyAccessSettings />)

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(mocks.refetchDefault).toHaveBeenCalledTimes(1)
  })

  it('registers Privacy & Access immediately after Account for every user', () => {
    const accountIndex = SETTINGS_CATEGORIES.findIndex(({ id }) => id === 'account')
    const privacyCategory = SETTINGS_CATEGORIES[accountIndex + 1]

    expect(privacyCategory).toMatchObject({
      id: 'privacy-access',
      label: 'Privacy & Access',
      description: 'Defaults for new recordings',
    })
    expect(privacyCategory.requiredRoles).toBeUndefined()
  })
})
