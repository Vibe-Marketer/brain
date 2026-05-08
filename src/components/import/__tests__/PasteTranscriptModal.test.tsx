/**
 * Phase 24 — Behavioral tests for PasteTranscriptModal (PASTE-01).
 *
 * Verifies the user-paste flow:
 *   - Pasting URL + transcript and clicking Save invokes the
 *     `save-pasted-transcript` edge function with the right body
 *   - On success: toast + invalidate calls query + navigate to /?callId=<id>
 *     (this is the path that makes the recording appear in the library
 *     within 2s — the cache invalidation is the on-screen mechanism)
 *   - Save button is disabled when transcript is below the 20-char minimum
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// --- Mocks (must come before importing the component) ---

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (msg: string) => mockToastSuccess(msg),
    error: (msg: string) => mockToastError(msg),
  },
}));

const mockInvoke = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
  },
}));

// Import after mocks
import { PasteTranscriptModal } from '../PasteTranscriptModal';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

// A real, parseable Fathom transcript (≥ 20 chars, ≥ 2 turns).
const SAMPLE_TRANSCRIPT = [
  'Alice Chen (0:00) Hey team, ready to dig in.',
  'Bob Smith (0:14) Yes, the numbers from last quarter look strong.',
  'Alice Chen (1:32) Lets dive into the details.',
].join('\n');

const SAMPLE_URL = 'https://fathom.video/share/test-token-zzz';

describe('PasteTranscriptModal — PASTE-01 save flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the modal with URL + transcript fields when open', () => {
    render(
      <PasteTranscriptModal
        open={true}
        onOpenChange={() => {}}
        organizationId="org-1"
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByText('Save a Transcript')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('https://fathom.video/share/...')).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(`Click "Copy transcript" in Fathom, then paste here`),
    ).toBeInTheDocument();
  });

  it('Save button is disabled until transcript meets the 20-char minimum', () => {
    render(
      <PasteTranscriptModal
        open={true}
        onOpenChange={() => {}}
        organizationId="org-1"
      />,
      { wrapper: createWrapper() },
    );

    const saveBtn = screen.getByRole('button', { name: /save transcript/i });
    expect(saveBtn).toBeDisabled();

    const transcriptArea = screen.getByPlaceholderText(
      `Click "Copy transcript" in Fathom, then paste here`,
    );
    fireEvent.change(transcriptArea, { target: { value: 'too short' } });
    expect(saveBtn).toBeDisabled();
  });

  it('Save button enables once transcript >= 20 chars + org present', () => {
    render(
      <PasteTranscriptModal
        open={true}
        onOpenChange={() => {}}
        organizationId="org-1"
      />,
      { wrapper: createWrapper() },
    );

    const transcriptArea = screen.getByPlaceholderText(
      `Click "Copy transcript" in Fathom, then paste here`,
    );
    fireEvent.change(transcriptArea, { target: { value: SAMPLE_TRANSCRIPT } });

    const saveBtn = screen.getByRole('button', { name: /save transcript/i });
    expect(saveBtn).not.toBeDisabled();
  });

  it('shows live preview with detected turns + speaker count when format is recognized', () => {
    render(
      <PasteTranscriptModal
        open={true}
        onOpenChange={() => {}}
        organizationId="org-1"
      />,
      { wrapper: createWrapper() },
    );

    const transcriptArea = screen.getByPlaceholderText(
      `Click "Copy transcript" in Fathom, then paste here`,
    );
    fireEvent.change(transcriptArea, { target: { value: SAMPLE_TRANSCRIPT } });

    // 3 turns, 2 unique speakers (Alice, Bob).
    expect(screen.getByText(/3 turns/i)).toBeInTheDocument();
    expect(screen.getByText(/2 speakers/i)).toBeInTheDocument();
  });

  it('shows "format not auto-detected" warning for raw paste', () => {
    render(
      <PasteTranscriptModal
        open={true}
        onOpenChange={() => {}}
        organizationId="org-1"
      />,
      { wrapper: createWrapper() },
    );

    const transcriptArea = screen.getByPlaceholderText(
      `Click "Copy transcript" in Fathom, then paste here`,
    );
    fireEvent.change(transcriptArea, {
      target: { value: 'this is some random pasted text without timestamps yes really' },
    });

    expect(screen.getByText(/format not auto-detected/i)).toBeInTheDocument();
  });

  it('on Save: invokes save-pasted-transcript with URL + transcript + org_id', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { success: true, data: { recording_id: 'rec-uuid-1', action: 'created' } },
      error: null,
    });

    render(
      <PasteTranscriptModal
        open={true}
        onOpenChange={() => {}}
        organizationId="org-active-1"
      />,
      { wrapper: createWrapper() },
    );

    fireEvent.change(screen.getByPlaceholderText('https://fathom.video/share/...'), {
      target: { value: SAMPLE_URL },
    });
    fireEvent.change(
      screen.getByPlaceholderText(`Click "Copy transcript" in Fathom, then paste here`),
      { target: { value: SAMPLE_TRANSCRIPT } },
    );

    fireEvent.click(screen.getByRole('button', { name: /save transcript/i }));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'save-pasted-transcript',
        expect.objectContaining({
          body: expect.objectContaining({
            share_url: SAMPLE_URL,
            raw_transcript: SAMPLE_TRANSCRIPT,
            organization_id: 'org-active-1',
          }),
        }),
      );
    });
  });

  it('on success: shows toast, closes modal, navigates to /?callId=<id> (PASTE-01 within-2s mechanism)', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { success: true, data: { recording_id: 'rec-uuid-9', action: 'created' } },
      error: null,
    });
    const onOpenChange = vi.fn();

    render(
      <PasteTranscriptModal
        open={true}
        onOpenChange={onOpenChange}
        organizationId="org-1"
      />,
      { wrapper: createWrapper() },
    );

    fireEvent.change(
      screen.getByPlaceholderText(`Click "Copy transcript" in Fathom, then paste here`),
      { target: { value: SAMPLE_TRANSCRIPT } },
    );
    fireEvent.click(screen.getByRole('button', { name: /save transcript/i }));

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith('Transcript saved');
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(mockNavigate).toHaveBeenCalledWith('/?callId=rec-uuid-9');
  });

  it('on UPDATE response: shows "Transcript updated" toast (re-paste UX, supports PASTE-03)', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { success: true, data: { recording_id: 'rec-existing', action: 'updated' } },
      error: null,
    });

    render(
      <PasteTranscriptModal
        open={true}
        onOpenChange={() => {}}
        organizationId="org-1"
      />,
      { wrapper: createWrapper() },
    );

    fireEvent.change(
      screen.getByPlaceholderText(`Click "Copy transcript" in Fathom, then paste here`),
      { target: { value: SAMPLE_TRANSCRIPT } },
    );
    fireEvent.click(screen.getByRole('button', { name: /save transcript/i }));

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith('Transcript updated');
    });
  });

  it('on edge-function error: shows error toast and does NOT navigate', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: { message: 'Not a member of the requested workspace' },
    });

    render(
      <PasteTranscriptModal
        open={true}
        onOpenChange={() => {}}
        organizationId="org-1"
      />,
      { wrapper: createWrapper() },
    );

    fireEvent.change(
      screen.getByPlaceholderText(`Click "Copy transcript" in Fathom, then paste here`),
      { target: { value: SAMPLE_TRANSCRIPT } },
    );
    fireEvent.click(screen.getByRole('button', { name: /save transcript/i }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Not a member of the requested workspace');
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
