import { describe, expect, it, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { TicketDetailDialog } from '@/components/settings/TicketDetailDialog';
import {
  useAttachmentUrl,
  useTicketDetail,
  useUpdateTicketStatus,
} from '@/hooks/useTickets';
import {
  useUpdateTicketQueueControls,
  useWorkTicketNow,
} from '@/hooks/useAdminTicketControls';
import { useRunnerRunsForTicket } from '@/hooks/useAdminDashboard';
import { useUserRole } from '@/hooks/useUserRole';

vi.mock('@/hooks/useTickets', () => ({
  useTicketDetail: vi.fn(),
  useUpdateTicketStatus: vi.fn(),
  useAttachmentUrl: vi.fn(),
  // AddNoteComposer (rendered inside the dialog) consumes this.
  useAddTicketMessage: () => ({ mutate: vi.fn(), isPending: false }),
}));

// AddNoteComposer reads the signed-in user via useAuth.
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' }, session: { user: { id: 'user-1' } } }),
}));

vi.mock('@/hooks/useAdminTicketControls', () => ({
  useUpdateTicketQueueControls: vi.fn(),
  useWorkTicketNow: vi.fn(),
}));

vi.mock('@/hooks/useAdminDashboard', () => ({
  useRunnerRunsForTicket: vi.fn(),
}));

vi.mock('@/hooks/useUserRole', () => ({
  useUserRole: vi.fn(),
}));

// TicketEvidence is unit-tested separately; stub it to a marker here so the
// dialog tests focus on mount conditions, not evidence parsing.
vi.mock('@/components/admin/TicketEvidence', () => ({
  TicketEvidence: ({ runnerRuns = [] }: { runnerRuns?: Array<{ id: string }> }) => (
    <div data-testid="ticket-evidence">runs:{runnerRuns.length}</div>
  ),
}));

vi.mock('@/components/ui/switch', () => ({
  Switch: ({ checked, onCheckedChange, ...props }: {
    checked?: boolean;
    onCheckedChange?: (v: boolean) => void;
    [key: string]: unknown;
  }) => (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange?.(!checked)}
      {...props}
    />
  ),
}));

// Inline-render Radix wrappers so jsdom interactions are deterministic
// (established repo test pattern — see SupportTicketDialog.test.tsx).
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open?: boolean; children: React.ReactNode }) =>
    open ? <div role="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: () => null,
}));

const mockUseTicketDetail = vi.mocked(useTicketDetail);
const mockUseUpdateTicketStatus = vi.mocked(useUpdateTicketStatus);
const mockUseAttachmentUrl = vi.mocked(useAttachmentUrl);
const mockUseUpdateTicketQueueControls = vi.mocked(useUpdateTicketQueueControls);
const mockUseWorkTicketNow = vi.mocked(useWorkTicketNow);
const mockUseRunnerRunsForTicket = vi.mocked(useRunnerRunsForTicket);
const mockUseUserRole = vi.mocked(useUserRole);

const queueMutate = vi.fn();
const workNowMutate = vi.fn();

function makeMessage(attachments: unknown, overrides: Record<string, unknown> = {}) {
  return {
    id: 'msg-1',
    ticket_id: 'ticket-1',
    author_type: 'user',
    author_id: 'user-1',
    body: 'Something broke',
    attachments,
    created_at: '2026-06-11T10:00:00.000Z',
    ...overrides,
  };
}

interface DetailOptions {
  attachments?: unknown;
  status?: string;
  priority?: number;
  urgent?: boolean;
  extraMessages?: Array<ReturnType<typeof makeMessage>>;
  /** Override for the blank-ticket fallback test (ticket f01a51, 2026-08-29). */
  messages?: Array<ReturnType<typeof makeMessage>>;
  context?: Record<string, unknown>;
}

function makeDetail(opts: DetailOptions = {}) {
  return {
    ticket: {
      id: 'a1b2c3d4-0000-0000-0000-000000000000',
      reporter_id: 'user-1',
      type: 'bug',
      severity: 'medium',
      status: opts.status ?? 'new',
      source: 'manual',
      context: opts.context ?? {},
      fingerprint: null,
      priority: opts.priority ?? 0,
      urgent: opts.urgent ?? false,
      created_at: '2026-06-11T10:00:00.000Z',
      updated_at: '2026-06-11T10:00:00.000Z',
    },
    messages:
      opts.messages ?? [makeMessage(opts.attachments), ...(opts.extraMessages ?? [])],
    events: [],
  };
}

function renderDialog(optsOrAttachments: DetailOptions | unknown[] = {}) {
  // Back-compat: existing attachment tests pass a raw attachments array.
  const opts: DetailOptions = Array.isArray(optsOrAttachments)
    ? { attachments: optsOrAttachments }
    : optsOrAttachments;
  mockUseTicketDetail.mockReturnValue({
    data: makeDetail(opts),
    isLoading: false,
  } as never);
  return render(
    <TicketDetailDialog open onOpenChange={() => {}} ticketId="ticket-1" />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseUpdateTicketStatus.mockReturnValue({ mutate: vi.fn(), isPending: false } as never);
  mockUseAttachmentUrl.mockReturnValue({
    data: 'https://signed.example.com/x?token=abc',
    isLoading: false,
    isError: false,
  } as never);
  mockUseUpdateTicketQueueControls.mockReturnValue({
    mutate: queueMutate,
    isPending: false,
  } as never);
  mockUseWorkTicketNow.mockReturnValue({
    mutate: workNowMutate,
    isPending: false,
  } as never);
  mockUseRunnerRunsForTicket.mockReturnValue({
    data: [],
    isLoading: false,
  } as never);
  // Default to non-admin; admin tests opt in explicitly.
  mockUseUserRole.mockReturnValue({ isAdmin: false } as never);
});

describe('TicketDetailDialog attachments (15-03, D-05)', () => {
  it('renders the screenshot preview and console log link from signed URLs', () => {
    renderDialog([
      { type: 'screenshot', path: 'user-1/shot.jpg', mime: 'image/jpeg', size_bytes: 123 },
      { type: 'console_log', path: 'user-1/log.json', mime: 'application/json', size_bytes: 45 },
    ]);

    expect(screen.getByText(/^attachments$/i)).toBeInTheDocument();

    const img = screen.getByRole('img', { name: /ticket screenshot/i });
    expect(img).toHaveAttribute('src', 'https://signed.example.com/x?token=abc');

    const link = screen.getByRole('link', { name: /console log \(json\)/i });
    expect(link).toHaveAttribute('href', 'https://signed.example.com/x?token=abc');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link.getAttribute('rel')).toContain('noopener');

    // Signed-URL resolution goes through the hook (no inline supabase calls)
    expect(mockUseAttachmentUrl).toHaveBeenCalledWith('user-1/shot.jpg');
    expect(mockUseAttachmentUrl).toHaveBeenCalledWith('user-1/log.json');
  });

  it('renders no Attachments group when the message has an empty attachments array', () => {
    renderDialog([]);

    expect(screen.queryByText(/^attachments$/i)).not.toBeInTheDocument();
    // The note renders in the thread and is also summarised in the activity
    // timeline ("Customer added a note"), so it appears more than once.
    expect(screen.getAllByText('Something broke').length).toBeGreaterThan(0);
  });

  it('skips invalid descriptor entries silently and renders only valid ones', () => {
    renderDialog([
      'not-an-object',
      { type: 'unknown_kind', path: 'user-1/x.bin' },
      { type: 'screenshot' }, // missing path
      null,
      { type: 'console_log', path: 'user-1/log.json', mime: 'application/json', size_bytes: 45 },
    ]);

    expect(screen.getByText(/^attachments$/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /console log \(json\)/i })).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('renders no group at all when every entry is invalid (tolerate unknown shapes)', () => {
    renderDialog([{ bogus: true }, 42]);

    expect(screen.queryByText(/^attachments$/i)).not.toBeInTheDocument();
  });

  it('shows the unavailable state when the signed URL fetch errors', () => {
    mockUseAttachmentUrl.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    } as never);

    renderDialog([
      { type: 'screenshot', path: 'user-1/shot.jpg', mime: 'image/jpeg', size_bytes: 123 },
    ]);

    expect(screen.getByText(/attachment unavailable/i)).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});

const agentMessage = makeMessage(null, {
  id: 'agent-msg-1',
  author_type: 'agent',
  body: '# Autopilot fix evidence',
});

describe('TicketDetailDialog queue controls (14-04)', () => {
  it('renders priority + URGENT controls for admins and wires the queue hook', () => {
    mockUseUserRole.mockReturnValue({ isAdmin: true } as never);
    renderDialog({ status: 'triaged', priority: 1, urgent: false });

    expect(screen.getByText('Priority')).toBeInTheDocument();
    const urgentSwitch = screen.getByRole('switch', { name: /toggle urgent/i });
    expect(urgentSwitch).toBeInTheDocument();

    fireEvent.click(urgentSwitch);
    expect(queueMutate).toHaveBeenCalledWith({
      ticketId: 'a1b2c3d4-0000-0000-0000-000000000000',
      patch: { urgent: true },
    });
  });

  it('fires Work now for an admin on an active ticket', () => {
    mockUseUserRole.mockReturnValue({ isAdmin: true } as never);
    renderDialog({ status: 'escalated' });

    fireEvent.click(screen.getByRole('button', { name: /work now/i }));
    expect(workNowMutate).toHaveBeenCalledWith('a1b2c3d4-0000-0000-0000-000000000000');
  });

  it('hides Work now on resolved/rejected tickets', () => {
    mockUseUserRole.mockReturnValue({ isAdmin: true } as never);
    renderDialog({ status: 'resolved' });

    expect(screen.queryByRole('button', { name: /work now/i })).not.toBeInTheDocument();
  });

  it('hides queue controls from non-admin viewers', () => {
    mockUseUserRole.mockReturnValue({ isAdmin: false } as never);
    renderDialog({ status: 'triaged' });

    expect(screen.queryByText('Priority')).not.toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: /toggle urgent/i })).not.toBeInTheDocument();
  });
});

describe('TicketDetailDialog revert control (auto-deploy)', () => {
  it('shows the undo/revert control for a resolved ticket that deployed a fix', () => {
    mockUseUserRole.mockReturnValue({ isAdmin: true } as never);
    mockUseRunnerRunsForTicket.mockReturnValue({
      data: [{ id: 'run-1', fix_sha: '02248d02c6bca582d42d703373815708ee0b614d' }],
      isLoading: false,
    } as never);

    renderDialog({ status: 'resolved' });

    expect(screen.getByText(/undo this fix/i)).toBeInTheDocument();
    expect(screen.getByText(/git revert 02248d02/i)).toBeInTheDocument();
  });

  it('does not show the revert control when there is no deployed fix sha', () => {
    mockUseUserRole.mockReturnValue({ isAdmin: true } as never);
    renderDialog({ status: 'resolved' });

    expect(screen.queryByText(/undo this fix/i)).not.toBeInTheDocument();
  });

  it('does not show approve/reject controls (the approval gate is removed)', () => {
    mockUseUserRole.mockReturnValue({ isAdmin: true } as never);
    renderDialog({ status: 'awaiting_approval' });

    expect(screen.queryByRole('button', { name: /approve fix/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^reject$/i })).not.toBeInTheDocument();
  });
});

describe('TicketDetailDialog evidence mount + regression (14-04 / 15-03)', () => {
  it('mounts TicketEvidence when an agent-authored message exists', () => {
    mockUseUserRole.mockReturnValue({ isAdmin: true } as never);
    renderDialog({ status: 'awaiting_approval', extraMessages: [agentMessage] });

    expect(screen.getByTestId('ticket-evidence')).toBeInTheDocument();
  });

  it('uses ticket runner rows inside the existing TicketEvidence surface', () => {
    mockUseUserRole.mockReturnValue({ isAdmin: true } as never);
    mockUseRunnerRunsForTicket.mockReturnValue({
      data: [{ id: 'run-1' }],
      isLoading: false,
    } as never);

    renderDialog({ status: 'awaiting_approval' });

    expect(mockUseRunnerRunsForTicket).toHaveBeenCalledWith(
      'a1b2c3d4-0000-0000-0000-000000000000',
    );
    expect(screen.getByTestId('ticket-evidence')).toHaveTextContent('runs:1');
  });

  it('does not mount TicketEvidence for an ordinary support ticket (no agent message)', () => {
    mockUseUserRole.mockReturnValue({ isAdmin: true } as never);
    renderDialog({ status: 'new' });

    expect(screen.queryByTestId('ticket-evidence')).not.toBeInTheDocument();
  });

  it('renders no admin surfaces at all for a reporter (15-03 byte-equivalence)', () => {
    mockUseUserRole.mockReturnValue({ isAdmin: false } as never);
    renderDialog({ status: 'awaiting_approval', extraMessages: [agentMessage] });

    // Reporter still sees the evidence (read-only), but none of the controls.
    expect(screen.queryByText('Priority')).not.toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: /toggle urgent/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /work now/i })).not.toBeInTheDocument();
  });
});

describe('TicketDetailDialog blank-ticket context fallback (ticket f01a51, 2026-08-29)', () => {
  it('falls back to context.title/description when ticket_messages is empty', () => {
    renderDialog({
      messages: [],
      context: {
        title: 'Reconcile critic, nightly, and weekly telemetry',
        description: 'Three nights had zero reviewed runs; define shared denominators.',
      },
    });

    expect(screen.queryByText('No messages on this ticket.')).not.toBeInTheDocument();
    expect(screen.getByText(/Reconcile critic, nightly, and weekly telemetry/)).toBeInTheDocument();
    expect(screen.getByText(/Three nights had zero reviewed runs/)).toBeInTheDocument();
  });

  it('still shows "No messages" for a genuinely empty ticket with no context fallback', () => {
    renderDialog({ messages: [], context: {} });

    expect(screen.getByText('No messages on this ticket.')).toBeInTheDocument();
  });
});
