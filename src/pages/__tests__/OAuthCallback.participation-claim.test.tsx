import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const auth = vi.hoisted(() => ({
  user: { id: 'user-1', email: 'alice@example.com' } as null | { id: string; email: string },
  signOut: vi.fn(),
}))
const claim = vi.hoisted(() => ({ inspect: vi.fn(), consume: vi.fn() }))
const authApi = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  signInWithOtp: vi.fn(),
  signInWithOAuth: vi.fn(),
  updateUser: vi.fn(),
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: auth.user, loading: false, signOut: auth.signOut }),
}))
vi.mock('@/hooks/useEventDiscovery', () => ({
  useInspectParticipationClaim: () => ({ mutateAsync: claim.inspect, isPending: false }),
  useConsumeParticipationClaim: () => ({ mutateAsync: claim.consume, isPending: false }),
}))
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { auth: authApi, functions: { invoke: vi.fn() } },
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { ProtectedRoute } from '@/components/ProtectedRoute'
import Login from '@/pages/Login'
import ParticipationClaim from '@/pages/ParticipationClaim'

const PENDING_KEY = 'pendingParticipationClaim'
const TOKEN = `${crypto.randomUUID().replace(/-/g, '')}${crypto.randomUUID().replace(/-/g, '')}`.slice(0, 43)

function renderRoot() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<ProtectedRoute><p>Private home</p></ProtectedRoute>} />
        <Route path="/claim-participation" element={<ParticipationClaim />} />
        <Route path="/events" element={<h1>Events</h1>} />
        <Route path="/login" element={<h1>Sign in</h1>} />
        <Route path="/s/:token" element={<h1>Shared call</h1>} />
      </Routes>
    </MemoryRouter>,
  )
}

function renderLogin(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/claim-participation" element={<h1>Claim participation</h1>} />
      </Routes>
    </MemoryRouter>,
  )
}

function enterCredentials() {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'alice@example.com' } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
}

describe('authentication return restores pending participation claims', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    localStorage.clear()
    window.history.replaceState({}, '', '/')
    auth.user = { id: 'user-1', email: 'alice@example.com' }
    auth.signOut.mockResolvedValue(undefined)
    claim.inspect.mockResolvedValue({
      status: 'valid',
      maskedInvitedEmail: 'a***@example.com',
      confirmationRequired: false,
    })
    claim.consume.mockResolvedValue({ status: 'claimed', discoveredEventCount: 1 })
    authApi.signInWithPassword.mockResolvedValue({ error: null })
    authApi.signInWithOAuth.mockResolvedValue({ error: null })
    authApi.signUp.mockResolvedValue({
      data: { user: { identities: [{}] }, session: { access_token: 'session' } },
      error: null,
    })
  })

  it('authenticated root bootstrap restores, inspects, and consumes the claim exactly once', async () => {
    sessionStorage.setItem(PENDING_KEY, TOKEN)
    sessionStorage.setItem('pendingShareToken', 'share-token-must-remain-separate')
    renderRoot()

    expect(await screen.findByRole('heading', { name: 'Events' })).toBeInTheDocument()
    expect(screen.queryByText('Private home')).not.toBeInTheDocument()
    expect(claim.inspect).toHaveBeenCalledTimes(1)
    expect(claim.consume).toHaveBeenCalledTimes(1)
    expect(claim.consume).toHaveBeenCalledWith({
      token: TOKEN,
      confirmEmailAttachment: false,
    })
    expect(sessionStorage.getItem(PENDING_KEY)).toBeNull()
    expect(sessionStorage.getItem('pendingShareToken')).toBe('share-token-must-remain-separate')
    expect(window.location.href).not.toContain(TOKEN)
  })

  it('authenticated root stops at the approved different-primary prompt without consuming', async () => {
    sessionStorage.setItem(PENDING_KEY, TOKEN)
    claim.inspect.mockResolvedValueOnce({
      status: 'valid',
      maskedInvitedEmail: 'a***@example.com',
      confirmationRequired: true,
    })
    renderRoot()

    expect(await screen.findByRole('button', { name: 'Add email and continue' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Use another account' })).toBeInTheDocument()
    expect(claim.inspect).toHaveBeenCalledTimes(1)
    expect(claim.consume).not.toHaveBeenCalled()
    expect(sessionStorage.getItem(PENDING_KEY)).toBe(TOKEN)
  })

  it('preserves a session-only claim while the signed-out root sends the user to login', async () => {
    auth.user = null
    sessionStorage.setItem(PENDING_KEY, TOKEN)
    renderRoot()

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(sessionStorage.getItem(PENDING_KEY)).toBe(TOKEN)
    expect(window.location.href).not.toContain(TOKEN)
  })

  it('repeated root rendering cannot duplicate claim restoration', async () => {
    sessionStorage.setItem(PENDING_KEY, TOKEN)
    const { rerender } = renderRoot()
    rerender(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<ProtectedRoute><p>Private home</p></ProtectedRoute>} />
          <Route path="/claim-participation" element={<ParticipationClaim />} />
          <Route path="/events" element={<h1>Events</h1>} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'Events' })).toBeInTheDocument()
    expect(claim.inspect).toHaveBeenCalledTimes(1)
    expect(claim.consume).toHaveBeenCalledTimes(1)
  })

  it('password sign-in resumes the clean claim route without consuming other pending destinations', async () => {
    sessionStorage.setItem(PENDING_KEY, TOKEN)
    sessionStorage.setItem('pendingShareToken', 'separate-share')
    renderLogin('/login')
    enterCredentials()
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('heading', { name: 'Claim participation' })).toBeInTheDocument()
    expect(authApi.signInWithPassword).toHaveBeenCalledTimes(1)
    expect(sessionStorage.getItem(PENDING_KEY)).toBe(TOKEN)
    expect(sessionStorage.getItem('pendingShareToken')).toBe('separate-share')
  })

  it('password signup with an immediate session resumes the clean claim route', async () => {
    sessionStorage.setItem(PENDING_KEY, TOKEN)
    renderLogin('/login?signup=true')
    enterCredentials()
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByRole('heading', { name: 'Claim participation' })).toBeInTheDocument()
    expect(authApi.signUp).toHaveBeenCalledTimes(1)
    expect(sessionStorage.getItem(PENDING_KEY)).toBe(TOKEN)
    expect(window.location.href).not.toContain(TOKEN)
  })

  it('signup awaiting email confirmation and Google OAuth preserve the session-only claim', async () => {
    sessionStorage.setItem(PENDING_KEY, TOKEN)
    authApi.signUp.mockResolvedValueOnce({
      data: { user: { identities: [{}] }, session: null },
      error: null,
    })
    const signup = renderLogin('/login?signup=true')
    enterCredentials()
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument()
    expect(sessionStorage.getItem(PENDING_KEY)).toBe(TOKEN)
    signup.unmount()

    renderLogin('/login')
    fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' }))
    await waitFor(() => expect(authApi.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/` },
    }))
    expect(sessionStorage.getItem(PENDING_KEY)).toBe(TOKEN)
  })

  it('does not re-run root restoration after claim completion navigates to Events', async () => {
    sessionStorage.setItem(PENDING_KEY, TOKEN)
    sessionStorage.setItem('pendingShareToken', 'separate-share')
    render(
      <MemoryRouter initialEntries={['/events']}>
        <Routes>
          <Route path="/events" element={<ProtectedRoute><h1>Events</h1></ProtectedRoute>} />
          <Route path="/claim-participation" element={<h1>Claim participation</h1>} />
          <Route path="/s/:token" element={<h1>Shared call</h1>} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'Events' })).toBeInTheDocument()
    expect(sessionStorage.getItem(PENDING_KEY)).toBe(TOKEN)
    expect(sessionStorage.getItem('pendingShareToken')).toBe('separate-share')
  })
})
