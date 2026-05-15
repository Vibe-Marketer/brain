/**
 * Phase 24 — Behavioral tests for PASTE-04 recording detail rendering.
 *
 * Requirement (PASTE-04): the recording detail page renders paste-source
 * recordings cleanly:
 *   - No broken video player (the codebase has none — verified by grep)
 *   - Transcript + metadata + source-link pill all present
 *   - VIEW button branches to "VIEW ON FATHOM" with the link icon (not the
 *     vidicon icon, which would mislead users into expecting a video)
 *
 * These tests render the actual call-detail components with a paste-source
 * fixture and verify the visible output. They also verify the inverse — a
 * regular Fathom-API-imported recording still shows "VIEW" (no regression).
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import * as React from 'react';

// CallDetailHeader is rendered inside a Radix Dialog; mock the parts we
// don't need so we can render the header in isolation.
vi.mock('@/components/sharing/ShareCallDialog', () => ({
  ShareCallDialog: () => null,
}));
vi.mock('@/components/dialogs/CopyToOrganizationDialog', () => ({
  CopyToOrganizationDialog: () => null,
}));
vi.mock('@/hooks/useFathomRefresh', () => ({
  useFathomRefresh: () => ({
    isPending: false,
    mutate: () => undefined,
  }),
}));
// Replace the Radix DialogHeader/DialogTitle wrapping with plain divs so the
// header can render outside a Dialog root in tests.
vi.mock('@/components/ui/dialog', async () => {
  return {
    DialogHeader: ({ children, ...props }: React.ComponentProps<'div'>) =>
      React.createElement('div', { ...props, 'data-testid': 'dialog-header' }, children),
    DialogTitle: ({ children, ...props }: React.ComponentProps<'h2'>) =>
      React.createElement('h2', { ...props }, children),
    Dialog: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
    DialogContent: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
    DialogDescription: ({ children }: { children: React.ReactNode }) => React.createElement('p', null, children),
    DialogFooter: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
  };
});

// CallOverviewTab pulls in TabsContent + ScrollArea — mock them so the test
// doesn't need a Tabs context.
vi.mock('@/components/ui/tabs', () => ({
  TabsContent: ({ children, ...props }: React.ComponentProps<'div'>) =>
    React.createElement('div', { ...props }, children),
}));
vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, ...props }: React.ComponentProps<'div'>) =>
    React.createElement('div', { ...props }, children),
}));
// SourceInfoSection renders raw call data fetched separately; not in scope.
vi.mock('@/components/call-detail/SourceInfoSection', () => ({
  SourceInfoSection: () => null,
}));
// react-markdown is heavy and not what we're testing.
vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => React.createElement('div', null, children),
}));

import { CallDetailHeader } from '../CallDetailHeader';
import { CallOverviewTab } from '../CallOverviewTab';
import type { Meeting } from '@/types';

// Cast Meeting fields without requiring the full union — the component only
// reads what we provide.
function makeMeeting(overrides: Partial<Meeting>): Meeting {
  return {
    recording_id: 'rec-paste-1',
    title: 'Pasted Q3 Sync',
    created_at: '2026-05-07T00:00:00Z',
    summary: '## A summary',
    full_transcript: 'transcript text',
    source_platform: 'fathom-paste',
    share_url: 'https://fathom.video/share/abc123',
    ...overrides,
  } as Meeting;
}

describe('PASTE-04 — CallDetailHeader VIEW button branches by source_platform', () => {
  const setIsEditing = vi.fn();
  const setEditedTitle = vi.fn();
  const setEditedSummary = vi.fn();
  const onSave = vi.fn();

  it('paste-source recording with share_url: renders "VIEW ON FATHOM" (not "VIEW")', () => {
    render(
      <CallDetailHeader
        call={makeMeeting({ source_platform: 'fathom-paste' })}
        isEditing={false}
        setIsEditing={setIsEditing}
        editedTitle="Pasted Q3 Sync"
        setEditedTitle={setEditedTitle}
        setEditedSummary={setEditedSummary}
        onSave={onSave}
        isSaving={false}
      />,
    );

    expect(screen.getByText('VIEW ON FATHOM')).toBeInTheDocument();
    // Crucial: the misleading plain "VIEW" label must NOT appear, since
    // there is no video to play for a paste-source recording.
    expect(screen.queryByText(/^VIEW$/)).not.toBeInTheDocument();
  });

  it('regular fathom recording (API-imported) still renders plain "VIEW" (no regression)', () => {
    render(
      <CallDetailHeader
        call={makeMeeting({ source_platform: 'fathom' })}
        isEditing={false}
        setIsEditing={setIsEditing}
        editedTitle="Sales Call"
        setEditedTitle={setEditedTitle}
        setEditedSummary={setEditedSummary}
        onSave={onSave}
        isSaving={false}
      />,
    );

    expect(screen.getByText(/^VIEW$/)).toBeInTheDocument();
    expect(screen.queryByText('VIEW ON FATHOM')).not.toBeInTheDocument();
  });

  it('paste-source without share_url: VIEW button is suppressed (no broken outbound link)', () => {
    render(
      <CallDetailHeader
        call={makeMeeting({ source_platform: 'fathom-paste', share_url: null })}
        isEditing={false}
        setIsEditing={setIsEditing}
        editedTitle="Pasted Q3 Sync"
        setEditedTitle={setEditedTitle}
        setEditedSummary={setEditedSummary}
        onSave={onSave}
        isSaving={false}
      />,
    );

    expect(screen.queryByText('VIEW ON FATHOM')).not.toBeInTheDocument();
    expect(screen.queryByText(/^VIEW$/)).not.toBeInTheDocument();
  });

  it('VIEW ON FATHOM button uses noopener,noreferrer when opening (T-24-08)', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    render(
      <CallDetailHeader
        call={makeMeeting({ source_platform: 'fathom-paste' })}
        isEditing={false}
        setIsEditing={setIsEditing}
        editedTitle="Pasted Q3 Sync"
        setEditedTitle={setEditedTitle}
        setEditedSummary={setEditedSummary}
        onSave={onSave}
        isSaving={false}
      />,
    );

    const btn = screen.getByText('VIEW ON FATHOM').closest('button');
    expect(btn).toBeTruthy();
    btn!.click();
    expect(openSpy).toHaveBeenCalledWith(
      'https://fathom.video/share/abc123',
      '_blank',
      'noopener,noreferrer',
    );

    openSpy.mockRestore();
  });
});

describe('PASTE-04 — CallOverviewTab source pill', () => {
  const setEditedSummary = vi.fn();

  it('paste-source: renders "From Fathom share link" pill', () => {
    render(
      <CallOverviewTab
        call={makeMeeting({ source_platform: 'fathom-paste' })}
        duration={92}
        callSpeakers={[]}
        callCategories={[]}
        isEditing={false}
        editedSummary=""
        setEditedSummary={setEditedSummary}
        sourceApp="fathom-paste"
      />,
    );

    expect(screen.getByText('From Fathom share link')).toBeInTheDocument();
  });

  it('non-paste-source (API fathom): does NOT render the source pill', () => {
    render(
      <CallOverviewTab
        call={makeMeeting({ source_platform: 'fathom' })}
        duration={92}
        callSpeakers={[]}
        callCategories={[]}
        isEditing={false}
        editedSummary=""
        setEditedSummary={setEditedSummary}
        sourceApp="fathom"
      />,
    );

    expect(screen.queryByText('From Fathom share link')).not.toBeInTheDocument();
  });

  it('paste-source: still renders core metadata (transcript-bearing recording is first-class)', () => {
    // PASTE-04: "transcript + metadata + source-link pill all present".
    // The transcript is rendered in CallTranscriptTab (separate tab), but
    // CallOverviewTab is responsible for metadata: date, duration,
    // recording id, share link, participants. Confirm all of those still
    // render — paste recordings are not a degraded view.
    render(
      <CallOverviewTab
        call={makeMeeting({ source_platform: 'fathom-paste' })}
        duration={92}
        callSpeakers={[
          { id: 1, recording_id: 'rec-paste-1', display_name: 'Alice', total_words: 100, speaking_time_seconds: 30 },
          { id: 2, recording_id: 'rec-paste-1', display_name: 'Bob',   total_words: 50,  speaking_time_seconds: 15 },
        ] as never}
        callCategories={[]}
        isEditing={false}
        editedSummary=""
        setEditedSummary={setEditedSummary}
        sourceApp="fathom-paste"
      />,
    );

    expect(screen.getByText('CALL DETAILS')).toBeInTheDocument();
    expect(screen.getByText(/92 minutes/)).toBeInTheDocument();
    expect(screen.getByText('rec-paste-1')).toBeInTheDocument();
    // Share link is rendered as an anchor — confirm the URL appears in the doc.
    expect(screen.getByText('https://fathom.video/share/abc123')).toBeInTheDocument();
    // Source pill is alongside the metadata.
    expect(screen.getByText('From Fathom share link')).toBeInTheDocument();
    // Speakers metadata present.
    expect(screen.getByText(/2 spoke/)).toBeInTheDocument();
  });
});

describe('PASTE-04 — no broken video player anywhere in call-detail surface', () => {
  it('the call-detail directory contains no <video> tag or VideoPlayer component', async () => {
    const { readFileSync, readdirSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const dir = resolve(process.cwd(), 'src/components/call-detail');
    const files = readdirSync(dir).filter((f) => f.endsWith('.tsx') || f.endsWith('.ts'));
    for (const f of files) {
      const src = readFileSync(resolve(dir, f), 'utf8');
      expect(src, `${f} should not embed a <video> tag`).not.toMatch(/<video[\s>]/);
      expect(src, `${f} should not import a VideoPlayer component`).not.toMatch(/VideoPlayer/);
    }
  });
});
