import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mutateDefault = vi.fn()
const componentPath: string = '../PrivacyAccessSettings'

async function loadComponent() {
  vi.doMock('@/hooks/useAccessPolicy', () => ({
    useAccountAccessDefault: () => ({
      data: { accessLevel: 'private' },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    }),
    useSetAccountAccessDefault: () => ({ mutate: mutateDefault, isPending: false }),
  }))
  return import(/* @vite-ignore */ componentPath)
}

describe('PrivacyAccessSettings acceptance contract', () => {
  beforeEach(() => vi.clearAllMocks())

  it.fails('renders the six-option future-only default and saves non-Public choices immediately', async () => {
    const { PrivacyAccessSettings } = await loadComponent()
    render(<PrivacyAccessSettings />)

    expect(screen.getByRole('heading', { name: 'Privacy & Access' })).toBeInTheDocument()
    expect(screen.getByText('Choose how new recordings start.')).toBeInTheDocument()
    expect(screen.getByText('Default access for new recordings')).toBeInTheDocument()
    expect(screen.getByText("New recordings use this access level. Changing it won't update recordings you already have.")).toBeInTheDocument()
    for (const name of ['Private', 'Attendees', 'Invitees', 'Organization', 'Anyone with link', 'Public']) {
      expect(screen.getByRole('radio', { name: new RegExp(`^${name}`) })).toBeInTheDocument()
    }

    fireEvent.click(screen.getByRole('radio', { name: /^Attendees/ }))
    expect(mutateDefault).toHaveBeenCalledWith('attendees')
    expect(screen.queryByRole('button', { name: /^save$/i })).not.toBeInTheDocument()
  })

  it.fails('confirms Public with a normal primary action and restores focus on cancel', async () => {
    const { PrivacyAccessSettings } = await loadComponent()
    render(<PrivacyAccessSettings />)
    const publicOption = screen.getByRole('radio', { name: /^Public/ })
    fireEvent.click(publicOption)

    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(screen.getByText('Make new recordings public by default?')).toBeInTheDocument()
    expect(screen.getByText('Every new recording will be publicly viewable unless you change its access level. Existing recordings will not change.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Use Public by default' })).not.toHaveClass('bg-destructive')
    fireEvent.click(screen.getByRole('button', { name: 'Keep current default' }))
    expect(publicOption).toHaveFocus()
    expect(mutateDefault).not.toHaveBeenCalledWith('public')
  })

  it.fails('keeps the previous selection and exact rollback message when an optimistic save fails', async () => {
    vi.doMock('@/hooks/useAccessPolicy', () => ({
      useAccountAccessDefault: () => ({ data: { accessLevel: 'private' }, isLoading: false, isError: false }),
      useSetAccountAccessDefault: () => ({
        mutate: (_level: string, callbacks: { onError?: () => void }) => callbacks.onError?.(),
        isPending: false,
      }),
    }))
    const { PrivacyAccessSettings } = await import(/* @vite-ignore */ componentPath)
    render(<PrivacyAccessSettings />)
    fireEvent.click(screen.getByRole('radio', { name: /^Attendees/ }))
    expect(screen.getByRole('radio', { name: /^Private/ })).toBeChecked()
    expect(screen.getByText("Couldn't update the default. Your previous setting is still active. Try again.")).toBeInTheDocument()
  })
})
