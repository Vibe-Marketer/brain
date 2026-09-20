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
