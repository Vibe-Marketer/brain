import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const componentPath: string = '../PublicRecordingView'
const state: { data: unknown; isLoading: boolean; isError: boolean } = {
  data: null,
  isLoading: false,
  isError: false,
}

async function loadPage() {
  vi.doMock('@/hooks/usePublicRecording', () => ({ usePublicRecording: () => state }))
  return import(/* @vite-ignore */ componentPath)
}

function renderPage(
  Component: React.ComponentType,
  initialEntry = '/public/11111111-1111-4111-a111-111111111111',
) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/public/:recordingId" element={<Component />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('PublicRecordingView allowlist contract', () => {
  beforeEach(() => Object.assign(state, { data: null, isLoading: false, isError: false }))

  it('renders only the public allowlisted content fields', async () => {
    Object.assign(state, {
      data: {
        recording_id: '11111111-1111-4111-a111-111111111111',
        call_name: 'Public quarterly review',
        recording_start_time: '2026-09-19T12:00:00Z',
        duration: 1800,
        full_transcript: 'Approved public transcript.',
      },
    })
    const { PublicRecordingView } = await loadPage()
    const { container } = renderPage(PublicRecordingView)
    expect(screen.getByRole('heading', { name: 'Public quarterly review' })).toBeInTheDocument()
    expect(screen.getByText('Approved public transcript.')).toBeInTheDocument()
    expect(container.textContent).not.toMatch(/owner|provider|source|workspace|organization/i)
    expect(container.innerHTML).not.toMatch(/owner_user_id|source_app|source_call_id|event_id|summary/i)
  })

  it.each([
    ['unavailable', { data: null, isLoading: false, isError: false }],
    ['network error', { data: null, isLoading: false, isError: true }],
  ])('uses the same generic copy for %s', async (_label, nextState) => {
    Object.assign(state, nextState)
    const { PublicRecordingView } = await loadPage()
    renderPage(PublicRecordingView)
    expect(screen.getByText('This recording is not available.')).toBeInTheDocument()
    expect(screen.queryByText(/owner|provider|source/i)).not.toBeInTheDocument()
  })

  it('uses the generic unavailable state for a malformed recording ID', async () => {
    const { PublicRecordingView } = await loadPage()
    renderPage(PublicRecordingView, '/public/not-a-uuid')
    expect(screen.getByText('This recording is not available.')).toBeInTheDocument()
  })

  it('marks network failure as an alert without disclosing recording existence', async () => {
    Object.assign(state, { data: null, isLoading: false, isError: true })
    const { PublicRecordingView } = await loadPage()
    renderPage(PublicRecordingView)
    expect(screen.getByRole('alert')).toHaveTextContent('This recording is not available.')
  })
})
