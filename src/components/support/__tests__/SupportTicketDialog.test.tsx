import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ScreenshotResult } from '@/lib/screenshot';
import { captureScreenshot } from '@/lib/screenshot';
import { submitSupportTicket } from '@/services/support-ticket.service';
import { SupportPopover } from '@/components/support/SupportPopover';
import { SupportTicketDialog } from '@/components/support/SupportTicketDialog';

// jsdom has no canvas — the real capture must never run in tests (RESEARCH Pitfall 7).
vi.mock('@/lib/screenshot', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/screenshot')>();
  return {
    ...actual,
    captureScreenshot: vi.fn(),
  };
});

vi.mock('@/services/support-ticket.service', () => ({
  submitSupportTicket: vi.fn().mockResolvedValue(undefined),
}));

// The dialog consumes useDebugPanel() (D-03); the provider isn't mounted in
// tests, so mock the module with a deterministic message set.
vi.mock('@/components/debug-panel', () => ({
  useDebugPanel: () => ({
    messages: [
      { id: 'e1', timestamp: 100, type: 'error', message: 'mocked console error' },
      { id: 'i1', timestamp: 200, type: 'info', message: 'mocked info line' },
    ],
  }),
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

  it('adding a screenshot via the Add screenshot file picker attaches it alongside the existing one', async () => {
    render(
      <SupportTicketDialog
        open
        onOpenChange={() => {}}
        screenshot={makeScreenshot('first')}
        onRetake={async () => null}
      />,
    );

    const file = new File(['pasted-bytes'], 'shot.png', { type: 'image/png' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getAllByRole('img', { name: /screenshot/i })).toHaveLength(2);
    });
    expect(screen.getByText(/2 screenshots attached/i)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /remove screenshot/i })).toHaveLength(2);
  });

  it('pasting an image into the message field attaches it as a screenshot', async () => {
    render(
      <SupportTicketDialog open onOpenChange={() => {}} screenshot={null} onRetake={async () => null} />,
    );

    const file = new File(['clip-bytes'], 'clip.png', { type: 'image/png' });
    const textarea = screen.getByLabelText(/message/i);
    fireEvent.paste(textarea, { clipboardData: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByRole('img', { name: /screenshot/i })).toBeInTheDocument();
    });
    expect(screen.getByText(/1 screenshot attached/i)).toBeInTheDocument();
  });

  it('removing one of several screenshots only removes that one', async () => {
    render(
      <SupportTicketDialog
        open
        onOpenChange={() => {}}
        screenshot={makeScreenshot('first')}
        onRetake={async () => null}
      />,
    );

    const file = new File(['pasted-bytes'], 'shot.png', { type: 'image/png' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => {
      expect(screen.getAllByRole('img', { name: /screenshot/i })).toHaveLength(2);
    });

    fireEvent.click(screen.getAllByRole('button', { name: /remove screenshot/i })[0]);

    await waitFor(() => {
      expect(screen.getAllByRole('img', { name: /screenshot/i })).toHaveLength(1);
    });
    expect(screen.getByText(/1 screenshot attached/i)).toBeInTheDocument();
  });
});

describe('SupportTicketDialog console buffer on submit (D-03)', () => {
  const mockSubmit = vi.mocked(submitSupportTicket);

  function readBlobText(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(blob);
    });
  }

  beforeEach(() => {
    mockSubmit.mockClear();
    mockSubmit.mockResolvedValue(undefined);
  });

  it('derives the console buffer from useDebugPanel messages and passes it to submit', async () => {
    render(
      <SupportTicketDialog open onOpenChange={() => {}} screenshot={null} onRetake={async () => null} />,
    );

    fireEvent.change(screen.getByLabelText(/message/i), {
      target: { value: 'something is broken' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send ticket/i }));

    await waitFor(() => expect(mockSubmit).toHaveBeenCalledTimes(1));

    const params = mockSubmit.mock.calls[0][0];
    expect(params.consoleBuffer).toBeDefined();
    expect(params.consoleBuffer?.blob.type).toBe('application/json');

    const parsed = JSON.parse(await readBlobText(params.consoleBuffer!.blob)) as {
      entries: Array<{ type: string; message: string }>;
    };
    expect(parsed.entries).toHaveLength(2);
    expect(parsed.entries[0]).toMatchObject({ type: 'error', message: 'mocked console error' });
    expect(parsed.entries[1]).toMatchObject({ type: 'info', message: 'mocked info line' });
  });
});

afterEach(() => {
  vi.useRealTimers();
});
