import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SidebarNav } from '../sidebar-nav';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const roleState = vi.hoisted(() => ({
  current: {
    role: 'FREE',
    loading: false,
    isAdmin: false,
    isTeam: false,
    isPro: false,
    isFree: true,
  },
}));

vi.mock('@/hooks/useUserRole', () => ({
  useUserRole: () => roleState.current,
}));

vi.mock('@/components/onboarding/HowItWorksModal', () => ({
  HowItWorksModal: () => null,
}));

vi.mock('@/components/onboarding/OnboardingVideoModal', () => ({
  OnboardingVideoModal: () => null,
}));

vi.mock('@/components/support/SupportTicketDialog', () => ({
  SupportTicketDialog: () => null,
}));

vi.mock('@/lib/tour', () => ({
  startTour: vi.fn(),
}));

const renderWithRouter = (
  props: React.ComponentProps<typeof SidebarNav> = {},
  initialEntries: string[] = ['/']
) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <SidebarNav {...props} />
      </MemoryRouter>
    </QueryClientProvider>
  );
};


describe('SidebarNav item visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders IMPORT and RULES nav items unconditionally (no feature-flag gate)', () => {
    renderWithRouter({ isCollapsed: false });

    expect(screen.getByTitle('IMPORT')).toBeInTheDocument();
    expect(screen.getByTitle('RULES')).toBeInTheDocument();
  });

  it('hides the ADMIN nav item for non-admin users', () => {
    roleState.current = {
      role: 'FREE',
      loading: false,
      isAdmin: false,
      isTeam: false,
      isPro: false,
      isFree: true,
    };
    renderWithRouter({ isCollapsed: false });

    expect(screen.queryByTitle('ADMIN')).not.toBeInTheDocument();
  });

  it('shows the ADMIN nav item for platform admins and navigates to /admin/dashboard', () => {
    roleState.current = {
      role: 'ADMIN',
      loading: false,
      isAdmin: true,
      isTeam: false,
      isPro: false,
      isFree: false,
    };
    renderWithRouter({ isCollapsed: false });

    const adminButton = screen.getByTitle('ADMIN');
    expect(adminButton).toBeInTheDocument();

    fireEvent.click(adminButton);
    expect(mockNavigate).toHaveBeenCalledWith('/admin/dashboard');

    // Reset for any later suites
    roleState.current = {
      role: 'FREE',
      loading: false,
      isAdmin: false,
      isTeam: false,
      isPro: false,
      isFree: true,
    };
  });
});

describe('SidebarNav support popover', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders one Support trigger and no standalone Take the tour / How it works buttons', () => {
    renderWithRouter({ isCollapsed: false });

    expect(screen.getByRole('button', { name: 'Support' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Take the tour' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'How it works' })).not.toBeInTheDocument();
  });

  it('shows required support actions in order', () => {
    renderWithRouter({ isCollapsed: false });

    fireEvent.click(screen.getByRole('button', { name: 'Support' }));

    const labels = [
      'Watch the Onboarding Video',
      'Take the Tour',
      'How It Works',
      'Support Docs',
      'Submit a Ticket',
    ];

    const actionButtons = screen.getAllByRole('button').map((node) => node.textContent ?? '');
    const labelIndexes = labels.map((label) => actionButtons.findIndex((text) => text.includes(label)));

    expect(labelIndexes.every((index) => index >= 0)).toBe(true);
    expect(labelIndexes).toEqual([...labelIndexes].sort((a, b) => a - b));
  });
});
