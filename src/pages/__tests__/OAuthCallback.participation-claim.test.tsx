import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const auth = vi.hoisted(() => ({
  user: { id: 'user-1', email: 'alice@example.com' } as null | { id: string; email: string },
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: auth.user, loading: false }),
}))

import { ProtectedRoute } from '@/components/ProtectedRoute'

const PENDING_KEY = 'pendingParticipationClaim'
const TOKEN = `${crypto.randomUUID().replace(/-/g, '')}${crypto.randomUUID().replace(/-/g, '')}`

describe('authentication return restores pending participation claims (Wave 0 RED)', () => {
  beforeEach(() => {
    sessionStorage.clear()
    localStorage.clear()
    auth.user = { id: 'user-1', email: 'alice@example.com' }
  })

  it.fails('RED: authenticated root bootstrap prioritizes the clean claim route', async () => {
    sessionStorage.setItem(PENDING_KEY, TOKEN)
    sessionStorage.setItem('pendingShareToken', 'share-token-must-remain-separate')

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<ProtectedRoute><p>Private home</p></ProtectedRoute>} />
          <Route path="/claim-participation" element={<h1>Claim participation</h1>} />
          <Route path="/s/:token" element={<h1>Shared call</h1>} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'Claim participation' })).toBeInTheDocument()
    expect(screen.queryByText('Private home')).not.toBeInTheDocument()
    expect(sessionStorage.getItem(PENDING_KEY)).toBe(TOKEN)
    expect(sessionStorage.getItem('pendingShareToken')).toBe('share-token-must-remain-separate')
  })

  it('preserves a session-only claim while the signed-out root sends the user to login', async () => {
    auth.user = null
    sessionStorage.setItem(PENDING_KEY, TOKEN)

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<ProtectedRoute><p>Private home</p></ProtectedRoute>} />
          <Route path="/login" element={<h1>Sign in</h1>} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(sessionStorage.getItem(PENDING_KEY)).toBe(TOKEN)
    expect(window.location.href).not.toContain(TOKEN)
  })

  it.fails('RED: repeated root rendering cannot duplicate claim restoration', async () => {
    sessionStorage.setItem(PENDING_KEY, TOKEN)
    const { rerender } = render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<ProtectedRoute><p>Private home</p></ProtectedRoute>} />
          <Route path="/claim-participation" element={<h1>Claim participation</h1>} />
        </Routes>
      </MemoryRouter>,
    )
    rerender(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<ProtectedRoute><p>Private home</p></ProtectedRoute>} />
          <Route path="/claim-participation" element={<h1>Claim participation</h1>} />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => expect(screen.getAllByRole('heading', { name: 'Claim participation' })).toHaveLength(1))
    expect(sessionStorage.getItem(PENDING_KEY)).toBe(TOKEN)
  })
})
