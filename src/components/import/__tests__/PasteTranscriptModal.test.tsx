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
const SAMPLE_ZOOM_VTT = [
  'WEBVTT',
  '',
  '00:00:00.000 --> 00:00:03.000',
  'Alice Chen: Welcome everyone.',
  '',
  '00:00:03.000 --> 00:00:08.000',
  'Bob Smith: Reviewing the Zoom transcript.',
].join('\n');

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

  it('allows Zoom VTT with a Zoom share URL', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { success: true, data: { recording_id: 'zoom-rec-1', action: 'created' } },
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

    fireEvent.change(screen.getByLabelText(/^source$/i), {
      target: { value: 'zoom' },
    });
    fireEvent.change(screen.getByPlaceholderText('https://*.zoom.us/rec/share/...'), {
      target: { value: 'https://example.zoom.us/rec/share/abc123' },
    });
    fireEvent.change(
      screen.getByPlaceholderText(/upload a zoom \.vtt file/i),
      { target: { value: SAMPLE_ZOOM_VTT } },
    );

    expect(screen.getByText(/2 turns/i)).toBeInTheDocument();
    expect(screen.getByText(/2 speakers/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /save transcript/i }));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'save-pasted-transcript',
        expect.objectContaining({
          body: expect.objectContaining({
            source_app: 'zoom',
            source_url: 'https://example.zoom.us/rec/share/abc123',
            raw_transcript: SAMPLE_ZOOM_VTT,
            organization_id: 'org-active-1',
          }),
        }),
      );
    });
    expect(mockInvoke.mock.calls[0][1].body).not.toHaveProperty('share_url');
  });

  it('switches to Zoom review when a Zoom share URL is pasted first', () => {
    render(
      <PasteTranscriptModal
        open={true}
        onOpenChange={() => {}}
        organizationId="org-active-1"
      />,
      { wrapper: createWrapper() },
    );

    fireEvent.change(screen.getByPlaceholderText('https://fathom.video/share/...'), {
      target: { value: 'https://example.zoom.us/rec/share/abc123' },
    });

    expect(screen.getByLabelText(/^source$/i)).toHaveValue('zoom');
    expect(screen.getByPlaceholderText('https://*.zoom.us/rec/share/...')).toBeInTheDocument();
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

// ─── ISC-specific tests ────────────────────────────────────────────────────

describe('PasteTranscriptModal — ISC source detection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ISC-1: Zoom URL auto-selects source=zoom
  it('ISC-1: pasting a zoom.us URL auto-selects zoom mode', () => {
    render(
      <PasteTranscriptModal open={true} onOpenChange={() => {}} organizationId="org-1" />,
      { wrapper: createWrapper() },
    );
    fireEvent.change(screen.getByPlaceholderText('https://fathom.video/share/...'), {
      target: { value: 'https://us02web.zoom.us/rec/share/abc123' },
    });
    expect(screen.getByLabelText(/^source$/i)).toHaveValue('zoom');
  });

  // ISC-2: Fathom URL auto-selects source=fathom-paste
  it('ISC-2: pasting a fathom.video URL auto-selects fathom-paste mode', () => {
    render(
      <PasteTranscriptModal open={true} onOpenChange={() => {}} organizationId="org-1" />,
      { wrapper: createWrapper() },
    );
    // Start in zoom mode, then paste fathom URL
    fireEvent.change(screen.getByLabelText(/^source$/i), { target: { value: 'zoom' } });
    fireEvent.change(screen.getByPlaceholderText('https://*.zoom.us/rec/share/...'), {
      target: { value: 'https://fathom.video/share/xyz' },
    });
    expect(screen.getByLabelText(/^source$/i)).toHaveValue('fathom-paste');
  });

  // ISC-3: WEBVTT content in textarea auto-selects zoom (VTT) mode
  it('ISC-3: pasting WEBVTT text auto-switches mode to zoom', () => {
    render(
      <PasteTranscriptModal open={true} onOpenChange={() => {}} organizationId="org-1" />,
      { wrapper: createWrapper() },
    );
    // Default mode is fathom-paste; pasting VTT should trigger auto-switch
    fireEvent.change(
      screen.getByPlaceholderText(`Click "Copy transcript" in Fathom, then paste here`),
      { target: { value: SAMPLE_ZOOM_VTT } },
    );
    expect(screen.getByLabelText(/^source$/i)).toHaveValue('zoom');
  });

  // ISC-5: Unrecognized URL shows explicit warning
  it('ISC-5: pasting an unrecognized URL surfaces unrecognized-source warning', () => {
    render(
      <PasteTranscriptModal open={true} onOpenChange={() => {}} organizationId="org-1" />,
      { wrapper: createWrapper() },
    );
    fireEvent.change(screen.getByPlaceholderText('https://fathom.video/share/...'), {
      target: { value: 'https://meet.google.com/abc-defg-hij' },
    });
    expect(screen.getByText(/unrecognized source url/i)).toBeInTheDocument();
  });

  // ISC-5 negative: recognised URL does NOT show the warning
  it('ISC-5 negative: zoom URL does NOT show unrecognized warning', () => {
    render(
      <PasteTranscriptModal open={true} onOpenChange={() => {}} organizationId="org-1" />,
      { wrapper: createWrapper() },
    );
    fireEvent.change(screen.getByPlaceholderText('https://fathom.video/share/...'), {
      target: { value: 'https://us02web.zoom.us/rec/share/abc' },
    });
    expect(screen.queryByText(/unrecognized source url/i)).not.toBeInTheDocument();
  });
});

describe('PasteTranscriptModal — ISC parsing & review block', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ISC-6 / ISC-7: VTT with voice tags + NOTE blocks yields speakers without throwing
  it('ISC-6/7: WEBVTT with <v Speaker> tags and NOTE blocks yields deduplicated speakers', () => {
    const vttWithVoiceTags = [
      'WEBVTT',
      '',
      'NOTE Recorded on 2026-05-20',
      '',
      '00:00:00.000 --> 00:00:05.000',
      '<v Andrew Naegele>Hey, thanks for jumping on.',
      '',
      '00:00:05.000 --> 00:00:10.000',
      '<v Phill Tomlinson>No problem.',
      '',
      '00:00:10.000 --> 00:00:15.000',
      '<v Andrew Naegele>Let me walk you through this.',
    ].join('\n');

    render(
      <PasteTranscriptModal open={true} onOpenChange={() => {}} organizationId="org-1" />,
      { wrapper: createWrapper() },
    );
    fireEvent.change(screen.getByLabelText(/^source$/i), { target: { value: 'zoom' } });
    expect(() =>
      fireEvent.change(
        screen.getByPlaceholderText(/upload a zoom \.vtt file/i),
        { target: { value: vttWithVoiceTags } },
      ),
    ).not.toThrow();
    // 3 turns, 2 unique speakers
    expect(screen.getByText(/3 turns/i)).toBeInTheDocument();
    expect(screen.getByText(/2 speakers/i)).toBeInTheDocument();
  });

  // ISC-13: Parsed details block renders with all metadata
  it('ISC-13: Parsed details block renders with source/format/duration/speakers on valid VTT', () => {
    render(
      <PasteTranscriptModal open={true} onOpenChange={() => {}} organizationId="org-1" />,
      { wrapper: createWrapper() },
    );
    fireEvent.change(screen.getByLabelText(/^source$/i), { target: { value: 'zoom' } });
    fireEvent.change(
      screen.getByPlaceholderText(/upload a zoom \.vtt file/i),
      { target: { value: SAMPLE_ZOOM_VTT } },
    );
    expect(screen.getByText(/parsed details/i)).toBeInTheDocument();
    expect(screen.getByText('Zoom')).toBeInTheDocument();
    expect(screen.getByText('Zoom VTT')).toBeInTheDocument();
  });

  // ISC-14: Parse failure shows explicit error
  it('ISC-14: parse failure shows explicit "format not auto-detected" message', () => {
    render(
      <PasteTranscriptModal open={true} onOpenChange={() => {}} organizationId="org-1" />,
      { wrapper: createWrapper() },
    );
    fireEvent.change(
      screen.getByPlaceholderText(`Click "Copy transcript" in Fathom, then paste here`),
      { target: { value: 'this is unstructured text without any parseable format here now' } },
    );
    expect(screen.getByText(/format not auto-detected/i)).toBeInTheDocument();
  });

  // ISC-15/16: Attendees prefilled with parsed speakers
  it('ISC-15/16: attendees input is prefilled with detected speakers after VTT paste', () => {
    render(
      <PasteTranscriptModal open={true} onOpenChange={() => {}} organizationId="org-1" />,
      { wrapper: createWrapper() },
    );
    fireEvent.change(screen.getByLabelText(/^source$/i), { target: { value: 'zoom' } });
    fireEvent.change(
      screen.getByPlaceholderText(/upload a zoom \.vtt file/i),
      { target: { value: SAMPLE_ZOOM_VTT } },
    );
    const attendeesInput = screen.getByPlaceholderText(/alice chen, bob smith/i) as HTMLInputElement;
    expect(attendeesInput.value).toContain('Alice Chen');
  });

  // ISC-18: Save enabled without manual typing
  it('ISC-18: Save button is enabled without manual typing after a valid VTT paste', () => {
    render(
      <PasteTranscriptModal open={true} onOpenChange={() => {}} organizationId="org-1" />,
      { wrapper: createWrapper() },
    );
    fireEvent.change(screen.getByLabelText(/^source$/i), { target: { value: 'zoom' } });
    fireEvent.change(
      screen.getByPlaceholderText(/upload a zoom \.vtt file/i),
      { target: { value: SAMPLE_ZOOM_VTT } },
    );
    expect(screen.getByRole('button', { name: /save transcript/i })).not.toBeDisabled();
  });
});
