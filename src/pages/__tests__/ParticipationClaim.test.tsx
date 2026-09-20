import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { BrowserRouter, useLocation } from 'react-router-dom'
import type { ComponentType } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const claim = vi.hoisted(() => ({
  user: null as null | { id: string; email: string },
  inspect: vi.fn(),
  consume: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: claim.user, loading: false, signOut: claim.signOut }),
}))
vi.mock('@/hooks/useEventDiscovery', () => ({
  useInspectParticipationClaim: () => ({ mutateAsync: claim.inspect, isPending: false }),
  useConsumeParticipationClaim: () => ({ mutateAsync: claim.consume, isPending: false }),
}))

const PAGE_MODULE = '/src/pages/ParticipationClaim.tsx'
const TOKEN = `${crypto.randomUUID().replace(/-/g, '')}${crypto.randomUUID().replace(/-/g, '')}`.slice(0, 43)
const PENDING_KEY = 'pendingParticipationClaim'

async function loadPage(): Promise<ComponentType> {
  const module = await import(/* @vite-ignore */ PAGE_MODULE) as {
    default?: ComponentType
    ParticipationClaim?: ComponentType
  }
  const Page = module.default ?? module.ParticipationClaim
  if (!Page) throw new Error('ParticipationClaim page export is missing')
  return Page
}

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>
}

function renderPage(Page: ComponentType) {
  return render(
    <BrowserRouter>
      <Page />
      <LocationProbe />
    </BrowserRouter>,
  )
}

describe('participation claim privacy and account flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    localStorage.clear()
    claim.user = null
    claim.inspect.mockResolvedValue({
      status: 'valid',
      maskedInvitedEmail: 'a***@example.com',
      confirmationRequired: false,
    })
    claim.consume.mockResolvedValue({ status: 'claimed', discoveredEventCount: 2 })
    claim.signOut.mockResolvedValue(undefined)
    window.history.replaceState({}, '', '/claim-participation')
  })

  it('captures once into dedicated session storage and scrubs URL before private UI', async () => {
    window.history.replaceState({}, '', `/claim-participation?token=${TOKEN}`)
    const replaceState = vi.spyOn(window.history, 'replaceState')
    const ClaimPage = await loadPage()
    const { container } = renderPage(ClaimPage)

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/claim-participation$/))
    expect(screen.getByTestId('location')).not.toHaveTextContent('token=')
    expect(replaceState.mock.calls.some((call) => !String(call[2]).includes(TOKEN))).toBe(true)
    expect(sessionStorage.getItem(PENDING_KEY)).toBeTruthy()
    expect(localStorage.getItem(PENDING_KEY)).toBeNull()
    expect(container.innerHTML).not.toContain(TOKEN)
    expect(claim.inspect).not.toHaveBeenCalled()
  })

  it('signed-out users see only the approved continuation action and no preview', async () => {
    sessionStorage.setItem(PENDING_KEY, TOKEN)
    const ClaimPage = await loadPage()
    const { container } = renderPage(ClaimPage)

    expect(screen.getByRole('button', { name: 'Continue to CallVault' })).toBeInTheDocument()
    expect(container.textContent).not.toMatch(/board meeting|recording owner|transcript|summary/i)
    expect(claim.inspect).not.toHaveBeenCalled()
    expect(claim.consume).not.toHaveBeenCalled()
  })

  it('scrubs a malformed URL credential into the same generic terminal state', async () => {
    window.history.replaceState({}, '', '/claim-participation?token=malformed')
    const ClaimPage = await loadPage()
    const { container } = renderPage(ClaimPage)

    expect(await screen.findByText(/This claim link is no longer available/i)).toBeInTheDocument()
    expect(window.location.search).toBe('')
    expect(container.innerHTML).not.toContain('malformed')
    expect(sessionStorage.getItem(PENDING_KEY)).toBeNull()
    expect(claim.inspect).not.toHaveBeenCalled()
    expect(claim.consume).not.toHaveBeenCalled()
  })

  it('intended account inspects once, consumes once without email attachment, then opens Events', async () => {
    claim.user = { id: 'user-1', email: 'alice@example.com' }
    sessionStorage.setItem(PENDING_KEY, TOKEN)
    const ClaimPage = await loadPage()
    renderPage(ClaimPage)

    await waitFor(() => expect(claim.inspect).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(claim.consume).toHaveBeenCalledWith({
      token: TOKEN,
      confirmEmailAttachment: false,
    }))
    expect(claim.consume).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/events'))
    expect(sessionStorage.getItem(PENDING_KEY)).toBeNull()
  })

  it('different-primary account requires one of the two approved choices', async () => {
    claim.user = { id: 'user-2', email: 'different@example.com' }
    sessionStorage.setItem(PENDING_KEY, TOKEN)
    claim.inspect.mockResolvedValueOnce({
      status: 'valid',
      maskedInvitedEmail: 'a***@example.com',
      confirmationRequired: true,
    })
    const ClaimPage = await loadPage()
    renderPage(ClaimPage)

    expect(await screen.findByText('a***@example.com')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add email and continue' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Use another account' })).toBeInTheDocument()
    expect(claim.consume).not.toHaveBeenCalled()
  })

  it('Add email and continue performs one atomic confirmed consume', async () => {
    claim.user = { id: 'user-2', email: 'different@example.com' }
    sessionStorage.setItem(PENDING_KEY, TOKEN)
    claim.inspect.mockResolvedValueOnce({
      status: 'valid', maskedInvitedEmail: 'a***@example.com', confirmationRequired: true,
    })
    const ClaimPage = await loadPage()
    renderPage(ClaimPage)

    const addButton = await screen.findByRole('button', { name: 'Add email and continue' })
    fireEvent.click(addButton)
    fireEvent.click(addButton)
    await waitFor(() => expect(claim.consume).toHaveBeenCalledWith({
      token: TOKEN,
      confirmEmailAttachment: true,
    }))
    expect(claim.consume).toHaveBeenCalledTimes(1)
  })

  it('Use another account signs out without consuming and preserves the pending claim', async () => {
    claim.user = { id: 'user-2', email: 'different@example.com' }
    sessionStorage.setItem(PENDING_KEY, TOKEN)
    claim.inspect.mockResolvedValueOnce({
      status: 'valid', maskedInvitedEmail: 'a***@example.com', confirmationRequired: true,
    })
    const ClaimPage = await loadPage()
    renderPage(ClaimPage)

    fireEvent.click(await screen.findByRole('button', { name: 'Use another account' }))
    await waitFor(() => expect(claim.signOut).toHaveBeenCalledTimes(1))
    expect(claim.consume).not.toHaveBeenCalled()
    expect(sessionStorage.getItem(PENDING_KEY)).toBe(TOKEN)
    expect(screen.getByTestId('location')).toHaveTextContent('/login')
  })

  it.each(['malformed', 'unknown', 'expired', 'used', 'revoked', 'superseded', 'conflict'])(
    '%s terminal result uses one generic state and clears the token',
    async (status) => {
      claim.user = { id: 'user-1', email: 'alice@example.com' }
      sessionStorage.setItem(PENDING_KEY, TOKEN)
      claim.inspect.mockResolvedValueOnce({ status: 'unavailable', reason: status })
      const ClaimPage = await loadPage()
      const { container } = renderPage(ClaimPage)

      expect(await screen.findByText(/This claim link is no longer available/i)).toBeInTheDocument()
      expect(container.textContent).not.toContain(status)
      expect(sessionStorage.getItem(PENDING_KEY)).toBeNull()
    },
  )

  it('retains the pending claim after a retryable transport failure and retries once', async () => {
    claim.user = { id: 'user-1', email: 'alice@example.com' }
    sessionStorage.setItem(PENDING_KEY, TOKEN)
    claim.inspect.mockRejectedValueOnce(new Error('offline'))
    const ClaimPage = await loadPage()
    renderPage(ClaimPage)

    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(claim.inspect).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(claim.consume).toHaveBeenCalledTimes(1))
    expect(sessionStorage.getItem(PENDING_KEY)).toBeNull()
  })
})
