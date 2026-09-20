import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { Layout } from '../Layout';

let onboardingState = {
  shouldShowOnboarding: false,
  loading: false,
};

// Mock the Supabase client to avoid env variable errors
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    }),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    },
  },
}));

// Mock hooks used by Layout that require QueryClient / Supabase
vi.mock('@/hooks/useOnboarding', () => ({
  useOnboarding: () => ({
    shouldShowOnboarding: onboardingState.shouldShowOnboarding,
    loading: onboardingState.loading,
    completeOnboarding: vi.fn(),
  }),
}));

// Mock child components that have their own complex dependencies
vi.mock('@/components/debug-panel', () => ({
  DebugPanel: () => <div data-testid="debug-panel" />,
}));

vi.mock('@/components/onboarding/OnboardingModal', () => ({
  OnboardingModal: () => null,
}));

vi.mock('@/components/billing/TrialCountdownBadge', () => ({
  TrialCountdownBadge: () => null,
}));

// ConnectionHealthGate calls useAuth() internally, which throws outside an
// AuthProvider. It's a standalone status indicator (no children rendered
// through it), so a no-op mock is safe here — same pattern as the other
// child components above.
vi.mock('@/components/connectors/ConnectionHealthGate', () => ({
  ConnectionHealthGate: () => null,
}));

// Mock the TopBar component to isolate Layout testing
vi.mock('@/components/ui/top-bar', () => ({
  TopBar: ({ pageLabel }: { pageLabel: string }) => (
    <div data-testid="top-bar" data-page-label={pageLabel}>
      TopBar: {pageLabel}
    </div>
  ),
}));

describe('Layout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onboardingState = {
      shouldShowOnboarding: false,
      loading: false,
    };
  });

  const renderWithRouter = (children: React.ReactNode, initialEntries: string[] = ['/']) => {
    return render(
      <MemoryRouter initialEntries={initialEntries}>
        <Layout>{children}</Layout>
      </MemoryRouter>
    );
  };

  function LocationProbe() {
    const location = useLocation();
    return <div data-testid="location">{location.pathname}</div>;
  }

  describe('layout structure', () => {
    it('should not render app chrome while onboarding status is loading', () => {
      onboardingState = {
        shouldShowOnboarding: false,
        loading: true,
      };

      renderWithRouter(<div data-testid="child-content">Test Content</div>, ['/']);

      expect(screen.queryByTestId('top-bar')).not.toBeInTheDocument();
      expect(screen.queryByTestId('child-content')).not.toBeInTheDocument();
      expect(screen.getByLabelText('Loading setup')).toBeInTheDocument();
    });

    it('should redirect setup-required users before rendering home content', async () => {
      onboardingState = {
        shouldShowOnboarding: true,
        loading: false,
      };

      render(
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route
              path="/"
              element={
                <Layout>
                  <div data-testid="child-content">Test Content</div>
                </Layout>
              }
            />
            <Route path="/setup" element={<LocationProbe />} />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.queryByTestId('top-bar')).not.toBeInTheDocument();
      expect(screen.queryByTestId('child-content')).not.toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getByTestId('location')).toHaveTextContent('/setup');
      });
    });

  });

});
