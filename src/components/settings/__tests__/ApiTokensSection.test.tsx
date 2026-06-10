import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ExportableCall } from '@/lib/export-utils'

const mocks = vi.hoisted(() => ({
  fetchAllCallsForObsidianExport: vi.fn(),
  exportToObsidian: vi.fn(),
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}))

vi.mock('@/hooks/useOrganizations', () => ({
  useOrganizations: () => ({
    data: [{ id: 'org-1', name: 'Acme Inc' }],
    isLoading: false,
    error: null,
  }),
}))

vi.mock('@/hooks/useApiTokens', () => ({
  useApiTokensList: () => ({ tokens: [], isLoading: false, error: null }),
  useGenerateApiToken: () => ({ mutate: vi.fn(), isPending: false }),
  useRevokeApiToken: () => ({ mutate: vi.fn(), isPending: false }),
}))

vi.mock('@/services/api-tokens.service', async () => {
  const actual = await vi.importActual<typeof import('@/services/api-tokens.service')>(
    '@/services/api-tokens.service',
  )
  return {
    ...actual,
    fetchAllCallsForObsidianExport: mocks.fetchAllCallsForObsidianExport,
  }
})

vi.mock('@/lib/export-utils', async () => {
  const actual = await vi.importActual<typeof import('@/lib/export-utils')>('@/lib/export-utils')
  return {
    ...actual,
    exportToObsidian: mocks.exportToObsidian,
  }
})

vi.mock('sonner', () => ({
  toast: mocks.toast,
}))

import ApiTokensSection from '../ApiTokensSection'

function exportableCall(): ExportableCall {
  return {
    recording_id: 'rec-1',
    canonical_uuid: 'rec-1',
    title: 'Sales call',
    created_at: '2026-06-01T12:00:00.000Z',
    recording_start_time: '2026-06-01T12:00:00.000Z',
    recording_end_time: '2026-06-01T12:30:00.000Z',
    recorded_by_name: 'Ada Lovelace',
    recorded_by_email: 'ada@example.com',
    calendar_invitees: [],
    full_transcript: 'Transcript body',
    summary: 'Summary',
    url: 'https://calls.example/rec-1',
    workspace_name: 'Sales',
  }
}

describe('ApiTokensSection export vault behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.fetchAllCallsForObsidianExport.mockResolvedValue([exportableCall()])
    mocks.exportToObsidian.mockResolvedValue(undefined)
  })

  it('renders Export vault and Download all calls', () => {
    render(<ApiTokensSection />)

    expect(screen.getByText('Export vault')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Download all calls/i })).toBeInTheDocument()
    expect(screen.getByText(/Obsidian ZIP/i)).toBeInTheDocument()
  })

  it('downloads all calls through the service and Obsidian export utility', async () => {
    render(<ApiTokensSection />)

    fireEvent.click(screen.getByRole('button', { name: /Download all calls/i }))

    await waitFor(() => {
      expect(mocks.fetchAllCallsForObsidianExport).toHaveBeenCalledWith('org-1')
      expect(mocks.exportToObsidian).toHaveBeenCalledWith([exportableCall()], 'Acme Inc')
      expect(mocks.toast.success).toHaveBeenCalledWith('Exported 1 calls to Obsidian ZIP')
    })
  })

  it('shows No calls to export when the service returns an empty vault', async () => {
    mocks.fetchAllCallsForObsidianExport.mockResolvedValueOnce([])

    render(<ApiTokensSection />)
    fireEvent.click(screen.getByRole('button', { name: /Download all calls/i }))

    await waitFor(() => {
      expect(mocks.toast.info).toHaveBeenCalledWith('No calls to export')
      expect(mocks.exportToObsidian).not.toHaveBeenCalled()
    })
  })

  it('shows Export failed when export retrieval fails', async () => {
    mocks.fetchAllCallsForObsidianExport.mockRejectedValueOnce(new Error('network failed'))

    render(<ApiTokensSection />)
    fireEvent.click(screen.getByRole('button', { name: /Download all calls/i }))

    await waitFor(() => {
      expect(mocks.toast.error).toHaveBeenCalledWith('Export failed — please try again')
    })
  })

  it('disables the export button while the export is pending', async () => {
    let resolveFetch: (calls: ExportableCall[]) => void = () => undefined
    mocks.fetchAllCallsForObsidianExport.mockImplementationOnce(
      () =>
        new Promise<ExportableCall[]>((resolve) => {
          resolveFetch = resolve
        }),
    )

    render(<ApiTokensSection />)
    fireEvent.click(screen.getByRole('button', { name: /Download all calls/i }))

    expect(screen.getByRole('button', { name: /Exporting/i })).toBeDisabled()

    resolveFetch([exportableCall()])
    await waitFor(() => expect(screen.getByRole('button', { name: /Download all calls/i })).toBeEnabled())
  })
})
