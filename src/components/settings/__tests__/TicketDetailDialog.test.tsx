import { describe, expect, it, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { TicketDetailDialog } from '@/components/settings/TicketDetailDialog';
import {
  useAttachmentUrl,
  useTicketDetail,
  useUpdateTicketStatus,
} from '@/hooks/useTickets';
import { useApproveTicket, useRejectTicket } from '@/hooks/useTicketApproval';
import { useUpdateTicketQueueControls } from '@/hooks/useAdminTicketControls';
import { useUserRole } from '@/hooks/useUserRole';

vi.mock('@/hooks/useTickets', () => ({
  useTicketDetail: vi.fn(),
  useUpdateTicketStatus: vi.fn(),
  useAttachmentUrl: vi.fn(),
}));

vi.mock('@/hooks/useTicketApproval', () => ({
  useApproveTicket: vi.fn(),
  useRejectTicket: vi.fn(),
}));

vi.mock('@/hooks/useAdminTicketControls', () => ({
  useUpdateTicketQueueControls: vi.fn(),
}));

vi.mock('@/hooks/useUserRole', () => ({
  useUserRole: vi.fn(),
}));

// TicketEvidence is unit-tested separately; stub it to a marker here so the
// dialog tests focus on mount conditions, not evidence parsing.
vi.mock('@/components/admin/TicketEvidence', () => ({
  TicketEvidence: () => <div data-testid="ticket-evidence" />,
}));

// Inline-render the AlertDialog wrappers (Radix portals) deterministically.
vi.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: ({ open, children }: { open?: boolean; children: React.ReactNode }) =>
    open ? <div role="alertdialog">{children}</div> : null,
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  AlertDialogAction: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
  AlertDialogCancel: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
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
const mockUseApproveTicket = vi.mocked(useApproveTicket);
const mockUseRejectTicket = vi.mocked(useRejectTicket);
const mockUseUpdateTicketQueueControls = vi.mocked(useUpdateTicketQueueControls);
const mockUseUserRole = vi.mocked(useUserRole);

const approveMutate = vi.fn();
const rejectMutate = vi.fn();
const queueMutate = vi.fn();

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
      context: {},
      fingerprint: null,
      priority: opts.priority ?? 0,
      urgent: opts.urgent ?? false,
      created_at: '2026-06-11T10:00:00.000Z',
      updated_at: '2026-06-11T10:00:00.000Z',
    },
    messages: [makeMessage(opts.attachments), ...(opts.extraMessages ?? [])],
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
  mockUseApproveTicket.mockReturnValue({
    mutate: approveMutate,
    isPending: false,
    isSuccess: false,
  } as never);
  mockUseRejectTicket.mockReturnValue({
    mutate: rejectMutate,
    isPending: false,
    isSuccess: false,
  } as never);
  mockUseUpdateTicketQueueControls.mockReturnValue({
    mutate: queueMutate,
    isPending: false,
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
    expect(screen.getByText('Something broke')).toBeInTheDocument();
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

describe('TicketDetailDialog approval bar (14-04, APPR-02)', () => {
  it('renders APPROVE/REJECT for an admin viewing an awaiting_approval ticket', () => {
    mockUseUserRole.mockReturnValue({ isAdmin: true } as never);
    renderDialog({ status: 'awaiting_approval' });

    expect(screen.getByRole('button', { name: /approve fix/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^reject$/i })).toBeInTheDocument();
  });

  it('hides the approval bar from non-admin viewers even on awaiting_approval', () => {
    mockUseUserRole.mockReturnValue({ isAdmin: false } as never);
    renderDialog({ status: 'awaiting_approval' });

    expect(screen.queryByRole('button', { name: /approve fix/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^reject$/i })).not.toBeInTheDocument();
  });

  it('hides the approval bar for admins when status is not awaiting_approval', () => {
    mockUseUserRole.mockReturnValue({ isAdmin: true } as never);
    renderDialog({ status: 'new' });

    expect(screen.queryByRole('button', { name: /approve fix/i })).not.toBeInTheDocument();
  });

  it('fires approveTicket after confirming in the AlertDialog', () => {
    mockUseUserRole.mockReturnValue({ isAdmin: true } as never);
    renderDialog({ status: 'awaiting_approval' });

    // Open the confirm dialog via the bar's trigger button.
    fireEvent.click(screen.getByRole('button', { name: /approve fix/i }));

    // With the AlertDialog now open, two "approve fix"-ish buttons exist: the
    // bar trigger ("APPROVE FIX") and the confirm action ("Approve fix").
    const confirm = screen.getByRole('alertdialog').querySelector('button:last-of-type');
    fireEvent.click(confirm as HTMLElement);

    expect(approveMutate).toHaveBeenCalledWith(
      'a1b2c3d4-0000-0000-0000-000000000000',
      expect.anything(),
    );
  });

  it('disables the reject submit until a reason is entered', () => {
    mockUseUserRole.mockReturnValue({ isAdmin: true } as never);
    renderDialog({ status: 'awaiting_approval' });

    fireEvent.click(screen.getByRole('button', { name: /^reject$/i }));

    const submit = screen.getByRole('button', { name: /reject fix/i });
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/rejection reason/i), {
      target: { value: 'not actually fixed' },
    });
    expect(submit).not.toBeDisabled();

    fireEvent.click(submit);
    expect(rejectMutate).toHaveBeenCalledWith(
      { ticketId: 'a1b2c3d4-0000-0000-0000-000000000000', reason: 'not actually fixed' },
      expect.anything(),
    );
  });

  it('shows the "merges on next poll" note once approval is recorded', () => {
    mockUseUserRole.mockReturnValue({ isAdmin: true } as never);
    mockUseApproveTicket.mockReturnValue({
      mutate: approveMutate,
      isPending: false,
      isSuccess: true,
    } as never);
    renderDialog({ status: 'awaiting_approval' });

    expect(screen.getByText(/dispatcher merges on next poll/i)).toBeInTheDocument();
    // Buttons replaced by the note — no fake optimistic resolve.
    expect(screen.queryByRole('button', { name: /approve fix/i })).not.toBeInTheDocument();
  });
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

  it('hides queue controls from non-admin viewers', () => {
    mockUseUserRole.mockReturnValue({ isAdmin: false } as never);
    renderDialog({ status: 'triaged' });

    expect(screen.queryByText('Priority')).not.toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: /toggle urgent/i })).not.toBeInTheDocument();
  });
});

describe('TicketDetailDialog evidence mount + regression (14-04 / 15-03)', () => {
  it('mounts TicketEvidence when an agent-authored message exists', () => {
    mockUseUserRole.mockReturnValue({ isAdmin: true } as never);
    renderDialog({ status: 'awaiting_approval', extraMessages: [agentMessage] });

    expect(screen.getByTestId('ticket-evidence')).toBeInTheDocument();
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
    expect(screen.queryByRole('button', { name: /approve fix/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^reject$/i })).not.toBeInTheDocument();
  });
});
