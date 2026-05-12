import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SharedCallView } from '../SharedCallView';

// Mocks
const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

const useSharedCallMock = vi.fn();
vi.mock('@/hooks/useSharing', () => ({
  useSharedCall: (opts: unknown) => useSharedCallMock(opts),
}));

const useAuthMock = vi.fn();
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}));

const renderAt = (token: string) =>
  render(
    <MemoryRouter initialEntries={[`/s/${token}`]}>
      <Routes>
        <Route path="/s/:token" element={<SharedCallView />} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  navigateMock.mockReset();
  useSharedCallMock.mockReset();
  useAuthMock.mockReset();
  useAuthMock.mockReturnValue({ user: null, loading: false });
});

describe('SharedCallView state machine', () => {
  it('renders Spinner when status is loading', () => {
    useSharedCallMock.mockReturnValue({ data: { status: 'loading' }, refetch: vi.fn() });
    renderAt('abc');
    expect(screen.getByText(/Loading shared call/i)).toBeInTheDocument();
  });

  it('renders PublicShareLanding for status=public-view', () => {
    useSharedCallMock.mockReturnValue({
      data: {
        status: 'public-view',
        inviter_name: 'Andrew N.',
        call_title: 'Q3 Sync',
        recipient_email: null,
        recipient_masked: null,
      },
      refetch: vi.fn(),
    });
    renderAt('abc');
    expect(screen.getByText(/Andrew N\. shared a call with you/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign up to view/i })).toBeInTheDocument();
  });

  it('renders WrongAccountState for status=wrong-recipient', () => {
    useAuthMock.mockReturnValue({ user: { id: 'u1' }, loading: false });
    useSharedCallMock.mockReturnValue({
      data: { status: 'wrong-recipient', recipient_masked: 'na***@gmail.com' },
      refetch: vi.fn(),
    });
    renderAt('abc');
    expect(screen.getByText(/This share is for a different account/)).toBeInTheDocument();
    expect(screen.getByText(/na\*\*\*@gmail\.com/)).toBeInTheDocument();
  });

  it('renders Call not found card for status=not-found', () => {
    useSharedCallMock.mockReturnValue({ data: { status: 'not-found' }, refetch: vi.fn() });
    renderAt('abc');
    expect(screen.getByText(/Call not found/i)).toBeInTheDocument();
  });

  it('renders Couldn\'t load card for status=error', () => {
    useSharedCallMock.mockReturnValue({
      data: { status: 'error', message: 'Boom' },
      refetch: vi.fn(),
    });
    renderAt('abc');
    expect(screen.getByText(/Couldn.t load the call/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Try again/i })).toBeInTheDocument();
  });

  it('renders Link revoked card for status=revoked', () => {
    useSharedCallMock.mockReturnValue({
      data: {
        status: 'revoked',
        shareLink: { id: 'x', status: 'revoked', revoked_at: '2026-01-01' },
      },
      refetch: vi.fn(),
    });
    renderAt('abc');
    expect(screen.getByText(/Link revoked/i)).toBeInTheDocument();
  });

  it('renders the full call view for status=ok', () => {
    useAuthMock.mockReturnValue({ user: { id: 'u1' }, loading: false });
    useSharedCallMock.mockReturnValue({
      data: {
        status: 'ok',
        shareLink: {
          id: 'x',
          share_token: 'abc',
          recipient_email: 'r@e.com',
          status: 'active',
          created_at: '2026-01-01',
        },
        call: {
          recording_id: 12345,
          call_name: 'Test Call',
          recorded_by_email: 'sender@e.com',
          recording_start_time: '2026-01-01T12:00:00Z',
          duration: '30m',
          full_transcript: 'hello',
        },
      },
      refetch: vi.fn(),
    });
    renderAt('abc');
    expect(screen.getByText('Test Call')).toBeInTheDocument();
    expect(screen.getByText(/Transcript/i)).toBeInTheDocument();
  });

  it('does not call navigate("/login") when unauthenticated and status=public-view', () => {
    useAuthMock.mockReturnValue({ user: null, loading: false });
    useSharedCallMock.mockReturnValue({
      data: {
        status: 'public-view',
        inviter_name: 'A',
        call_title: 'B',
        recipient_email: null,
        recipient_masked: null,
      },
      refetch: vi.fn(),
    });
    renderAt('abc');
    expect(navigateMock).not.toHaveBeenCalledWith('/login');
  });
});
