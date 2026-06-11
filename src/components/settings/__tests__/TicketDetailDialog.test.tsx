import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TicketDetailDialog } from '@/components/settings/TicketDetailDialog';
import {
  useAttachmentUrl,
  useTicketDetail,
  useUpdateTicketStatus,
} from '@/hooks/useTickets';

vi.mock('@/hooks/useTickets', () => ({
  useTicketDetail: vi.fn(),
  useUpdateTicketStatus: vi.fn(),
  useAttachmentUrl: vi.fn(),
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

function makeMessage(attachments: unknown) {
  return {
    id: 'msg-1',
    ticket_id: 'ticket-1',
    author_type: 'user',
    author_id: 'user-1',
    body: 'Something broke',
    attachments,
    created_at: '2026-06-11T10:00:00.000Z',
  };
}

function makeDetail(attachments: unknown) {
  return {
    ticket: {
      id: 'a1b2c3d4-0000-0000-0000-000000000000',
      reporter_id: 'user-1',
      type: 'bug',
      severity: 'medium',
      status: 'new',
      source: 'manual',
      context: {},
      fingerprint: null,
      created_at: '2026-06-11T10:00:00.000Z',
      updated_at: '2026-06-11T10:00:00.000Z',
    },
    messages: [makeMessage(attachments)],
    events: [],
  };
}

function renderDialog(attachments: unknown) {
  mockUseTicketDetail.mockReturnValue({
    data: makeDetail(attachments),
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
