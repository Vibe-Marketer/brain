import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ScreenshotResult } from '@/lib/screenshot';
import { captureScreenshot } from '@/lib/screenshot';
import { SupportPopover } from '@/components/support/SupportPopover';
import { SupportTicketDialog } from '@/components/support/SupportTicketDialog';

// jsdom has no canvas — the real capture must never run in tests (RESEARCH Pitfall 7).
vi.mock('@/lib/screenshot', () => ({
  captureScreenshot: vi.fn(),
}));

vi.mock('@/services/support-ticket.service', () => ({
  submitSupportTicket: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1', email: 'user@example.com' } }),
}));

vi.mock('@/hooks/useOrganizationContext', () => ({
  useOrganizationContext: () => ({ activeOrgId: 'org-1', activeWorkspaceId: 'ws-1' }),
}));

vi.mock('@/lib/tour', () => ({ startTour: vi.fn() }));

vi.mock('@/components/onboarding/HowItWorksModal', () => ({
  HowItWorksModal: () => null,
}));

vi.mock('@/components/onboarding/OnboardingVideoModal', () => ({
  OnboardingVideoModal: () => null,
}));

// Inline-render Radix wrappers so jsdom interactions are deterministic
// (established repo test pattern — see CreateWorkspaceDialog.test.tsx).
vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open?: boolean; children: React.ReactNode }) =>
    open ? <div role="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));

const mockCapture = vi.mocked(captureScreenshot);

function makeScreenshot(seed: string): ScreenshotResult {
  return {
    dataUrl: `data:image/jpeg;base64,${seed}`,
    blob: new Blob([seed], { type: 'image/jpeg' }),
    metadata: {
      timestamp: 1718000000000,
      url: 'https://app.callvaultai.com/calls/123',
      viewport: { width: 1280, height: 800 },
      userAgent: 'vitest',
    },
  };
}

describe('SupportPopover pre-dialog capture (D-01)', () => {
  beforeEach(() => {
    mockCapture.mockReset();
  });

  it('captures the problem view BEFORE the dialog mounts, then shows the thumbnail', async () => {
    let resolveCapture: (value: ScreenshotResult) => void = () => {};
    mockCapture.mockImplementation(
      () =>
        new Promise<ScreenshotResult>((resolve) => {
          resolveCapture = resolve;
        }),
    );

    render(<SupportPopover />);
    fireEvent.click(screen.getByRole('button', { name: /submit a ticket/i }));

    // Capture is in-flight — the dialog must NOT be mounted yet.
    expect(mockCapture).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    resolveCapture(makeScreenshot('first'));

    const thumbnail = await screen.findByRole('img', { name: /screenshot/i });
    expect(thumbnail).toHaveAttribute('src', 'data:image/jpeg;base64,first');
    expect(screen.getByText(/screenshot attached/i)).toBeInTheDocument();
  });

  it('passes the dialog-exclusion list so portals/dialogs never appear in the capture', async () => {
    mockCapture.mockResolvedValue(makeScreenshot('excl'));

    render(<SupportPopover />);
    fireEvent.click(screen.getByRole('button', { name: /submit a ticket/i }));

    await screen.findByRole('dialog');

    const options = mockCapture.mock.calls[0][0];
    expect(options?.excludeElements).toEqual(
      expect.arrayContaining([
        '[data-radix-portal]',
        '[data-radix-popper-content-wrapper]',
        '[role="dialog"]',
      ]),
    );
  });

  it('still opens the dialog with a "Screenshot unavailable" state when capture fails', async () => {
    mockCapture.mockRejectedValue(new Error('canvas exploded'));

    render(<SupportPopover />);
    fireEvent.click(screen.getByRole('button', { name: /submit a ticket/i }));

    await screen.findByRole('dialog');
    expect(screen.getByText(/screenshot unavailable/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retake/i })).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /screenshot/i })).not.toBeInTheDocument();
  });

  it('opens the dialog without a screenshot when capture exceeds the 5s timeout', async () => {
    vi.useFakeTimers();
    try {
      mockCapture.mockImplementation(() => new Promise<ScreenshotResult>(() => {}));

      render(<SupportPopover />);
      fireEvent.click(screen.getByRole('button', { name: /submit a ticket/i }));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      await vi.advanceTimersByTimeAsync(5100);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/screenshot unavailable/i)).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('Retake replaces the screenshot with a fresh capture', async () => {
    mockCapture.mockResolvedValueOnce(makeScreenshot('first'));

    render(<SupportPopover />);
    fireEvent.click(screen.getByRole('button', { name: /submit a ticket/i }));

    const thumbnail = await screen.findByRole('img', { name: /screenshot/i });
    expect(thumbnail).toHaveAttribute('src', 'data:image/jpeg;base64,first');

    mockCapture.mockResolvedValueOnce(makeScreenshot('second'));
    fireEvent.click(screen.getByRole('button', { name: /retake/i }));

    await waitFor(() => {
      expect(screen.getByRole('img', { name: /screenshot/i })).toHaveAttribute(
        'src',
        'data:image/jpeg;base64,second',
      );
    });
    expect(mockCapture).toHaveBeenCalledTimes(2);
  });

  it('Remove clears the screenshot and the dialog shows the unavailable state', async () => {
    mockCapture.mockResolvedValue(makeScreenshot('first'));

    render(<SupportPopover />);
    fireEvent.click(screen.getByRole('button', { name: /submit a ticket/i }));

    await screen.findByRole('img', { name: /screenshot/i });
    fireEvent.click(screen.getByRole('button', { name: /remove/i }));

    expect(screen.queryByRole('img', { name: /screenshot/i })).not.toBeInTheDocument();
    expect(screen.getByText(/screenshot unavailable/i)).toBeInTheDocument();
  });
});

describe('SupportTicketDialog thumbnail block (D-02)', () => {
  it('renders the thumbnail from ScreenshotResult.dataUrl with alt text', () => {
    render(
      <SupportTicketDialog
        open
        onOpenChange={() => {}}
        screenshot={makeScreenshot('direct')}
        onRetake={async () => null}
      />,
    );

    const img = screen.getByRole('img', { name: /screenshot/i });
    expect(img).toHaveAttribute('src', 'data:image/jpeg;base64,direct');
    expect(screen.getByText(/screenshot attached/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retake/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /remove/i })).toBeInTheDocument();
  });

  it('shows "Screenshot unavailable" with only Retake when no screenshot exists', () => {
    render(
      <SupportTicketDialog
        open
        onOpenChange={() => {}}
        screenshot={null}
        onRetake={async () => null}
      />,
    );

    expect(screen.getByText(/screenshot unavailable/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retake/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /remove/i })).not.toBeInTheDocument();
  });
});

afterEach(() => {
  vi.useRealTimers();
});
