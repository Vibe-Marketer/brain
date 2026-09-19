import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { CallDetailPage } from '@/pages/CallDetailPage'

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>
}

function renderRoute(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/call/:callId" element={<CallDetailPage />} />
        <Route path="/transcripts" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('CallDetailPage access deep-link bridge', () => {
  it('preserves validated recording and request UUIDs in the final transcripts route', async () => {
    renderRoute('/call/11111111-1111-4111-a111-111111111111?accessRequest=22222222-2222-4222-a222-222222222222')
    expect(await screen.findByTestId('location')).toHaveTextContent(
      '/transcripts?callId=11111111-1111-4111-a111-111111111111&accessRequest=22222222-2222-4222-a222-222222222222',
    )
  })

  it('drops malformed access state instead of propagating it', async () => {
    renderRoute('/call/11111111-1111-4111-a111-111111111111?accessRequest=not-a-uuid')
    expect(await screen.findByTestId('location')).toHaveTextContent(
      '/transcripts?callId=11111111-1111-4111-a111-111111111111',
    )
  })
})
