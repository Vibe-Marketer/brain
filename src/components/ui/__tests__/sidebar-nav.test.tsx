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

vi.mock('@/hooks/useFeatureFlags', () => ({
  useFeatureFlags: () => ({ isFeatureEnabled: () => true }),
}));

vi.mock('@/hooks/useUserRole', () => ({
  useUserRole: () => ({
    role: 'FREE',
    loading: false,
    isAdmin: false,
    isTeam: false,
    isPro: false,
    isFree: true,
  }),
}));

vi.mock('@/components/onboarding/HowItWorksModal', () => ({
  HowItWorksModal: () => null,
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

describe('SidebarNav', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render all navigation items', () => {
      renderWithRouter();

      expect(screen.getByTitle('All Calls')).toBeInTheDocument();
      expect(screen.getByTitle('Shared With Me')).toBeInTheDocument();
      expect(screen.getByTitle('Import')).toBeInTheDocument();
      expect(screen.getByTitle('Rules')).toBeInTheDocument();
      expect(screen.getByTitle('Settings')).toBeInTheDocument();
    });

    it('should render labels in expanded mode', () => {
      renderWithRouter({ isCollapsed: false });

      expect(screen.getByText('All Calls')).toBeInTheDocument();
      expect(screen.getByText('Shared With Me')).toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    it('should have navigation landmark', () => {
      renderWithRouter();

      const nav = screen.getByRole('navigation', { name: 'App navigation' });
      expect(nav).toBeInTheDocument();
    });

    it('should have a separator line at the bottom section', () => {
      const { container } = renderWithRouter();

      const separator = container.querySelector('.border-t.border-border\\/40');
      expect(separator).toBeInTheDocument();
    });
  });

  describe('navigation', () => {
    it('should navigate to / on All Calls click', () => {
      renderWithRouter();

      fireEvent.click(screen.getByTitle('All Calls'));
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });

    it('should navigate to /shared-with-me on Shared With Me click', () => {
      renderWithRouter();

      fireEvent.click(screen.getByTitle('Shared With Me'));
      expect(mockNavigate).toHaveBeenCalledWith('/shared-with-me');
    });

    it('should navigate to /import on Import click', () => {
      renderWithRouter();

      fireEvent.click(screen.getByTitle('Import'));
      expect(mockNavigate).toHaveBeenCalledWith('/import');
    });

    it('should navigate to /rules on Rules click', () => {
      renderWithRouter();

      fireEvent.click(screen.getByTitle('Rules'));
      expect(mockNavigate).toHaveBeenCalledWith('/rules');
    });

    it('should navigate to /settings on Settings click', () => {
      renderWithRouter();

      fireEvent.click(screen.getByTitle('Settings'));
      expect(mockNavigate).toHaveBeenCalledWith('/settings');
    });
  });

  describe('active state', () => {
    it('should mark All Calls as active on root path', () => {
      renderWithRouter({ isCollapsed: false }, ['/']);

      const allCallsButton = screen.getByTitle('All Calls');
      expect(allCallsButton).toHaveClass('bg-muted');
    });

    it('should mark All Calls as active on /transcripts path', () => {
      renderWithRouter({ isCollapsed: false }, ['/transcripts']);

      const allCallsButton = screen.getByTitle('All Calls');
      expect(allCallsButton).toHaveClass('bg-muted');
    });

    it('should mark Settings as active on /settings path', () => {
      renderWithRouter({ isCollapsed: false }, ['/settings']);

      const settingsButton = screen.getByTitle('Settings');
      expect(settingsButton).toHaveClass('bg-muted');
    });

    it('should not mark inactive items with active class', () => {
      renderWithRouter({ isCollapsed: false }, ['/settings']);

      const allCallsButton = screen.getByTitle('All Calls');
      expect(allCallsButton).not.toHaveClass('bg-muted');
    });

    it('should render orange icon on active item', () => {
      const { container } = renderWithRouter({ isCollapsed: false }, ['/']);

      const activeIcon = container.querySelector('.text-vibe-orange');
      expect(activeIcon).toBeInTheDocument();
    });

    it('should mark Rules as active on /sorting-tagging/rules path', () => {
      renderWithRouter({ isCollapsed: false }, ['/sorting-tagging/rules']);

      const rulesButton = screen.getByTitle('Rules');
      expect(rulesButton).toHaveClass('bg-muted');
    });

    it('should set aria-current="page" on active item', () => {
      renderWithRouter({ isCollapsed: false }, ['/']);

      const allCallsButton = screen.getByTitle('All Calls');
      expect(allCallsButton).toHaveAttribute('aria-current', 'page');
    });

    it('should not set aria-current on inactive items', () => {
      renderWithRouter({ isCollapsed: false }, ['/']);

      const settingsButton = screen.getByTitle('Settings');
      expect(settingsButton).not.toHaveAttribute('aria-current');
    });
  });

  describe('collapsed mode', () => {
    it('should have orange icon on active item when collapsed', () => {
      const { container } = renderWithRouter({ isCollapsed: true }, ['/']);

      // Active icon is styled with text-vibe-orange
      const activeIcon = container.querySelector('.text-vibe-orange');
      expect(activeIcon).toBeInTheDocument();
    });

    it('should apply aria-label on collapsed buttons', () => {
      renderWithRouter({ isCollapsed: true });

      // In collapsed mode, buttons get aria-label since label text is hidden
      const allCallsButton = screen.getByTitle('All Calls');
      expect(allCallsButton).toHaveAttribute('aria-label', 'All Calls');
    });

    it('should not have aria-label in expanded mode', () => {
      renderWithRouter({ isCollapsed: false });

      const allCallsButton = screen.getByTitle('All Calls');
      expect(allCallsButton).not.toHaveAttribute('aria-label');
    });
  });

  describe('optional callbacks', () => {
    it('should render library toggle button when onLibraryToggle is provided', () => {
      const onLibraryToggle = vi.fn();
      renderWithRouter({ onLibraryToggle });

      expect(screen.getByText('Workspace Panel')).toBeInTheDocument();
    });

    it('should call onLibraryToggle when library button is clicked', () => {
      const onLibraryToggle = vi.fn();
      renderWithRouter({ onLibraryToggle });

      fireEvent.click(screen.getByText('Workspace Panel'));
      expect(onLibraryToggle).toHaveBeenCalledTimes(1);
    });

    it('should not render workspace panel button when onLibraryToggle is not provided', () => {
      renderWithRouter();

      expect(screen.queryByText('Workspace Panel')).not.toBeInTheDocument();
    });

    it('should call onSettingsClick when Settings is clicked', () => {
      const onSettingsClick = vi.fn();
      renderWithRouter({ onSettingsClick });

      fireEvent.click(screen.getByTitle('Settings'));
      expect(onSettingsClick).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith('/settings');
    });
  });

  describe('className prop', () => {
    it('should apply custom className', () => {
      const { container } = renderWithRouter({ className: 'custom-class' });

      const outerDiv = container.firstChild as HTMLElement;
      expect(outerDiv).toHaveClass('custom-class');
    });

    it('should preserve default flex-shrink-0 class', () => {
      const { container } = renderWithRouter({ className: 'custom-class' });

      const outerDiv = container.firstChild as HTMLElement;
      expect(outerDiv).toHaveClass('flex-shrink-0');
    });
  });

  describe('accessibility', () => {
    it('should have buttons with type="button"', () => {
      renderWithRouter();

      const buttons = screen.getAllByRole('button');
      buttons.forEach((button) => {
        expect(button).toHaveAttribute('type', 'button');
      });
    });

    it('should have title attributes on all nav buttons', () => {
      renderWithRouter();

      expect(screen.getByTitle('All Calls')).toBeInTheDocument();
      expect(screen.getByTitle('Shared With Me')).toBeInTheDocument();
      expect(screen.getByTitle('Settings')).toBeInTheDocument();
    });

    it('should have focus-visible styling classes on nav buttons', () => {
      renderWithRouter();

      const allCallsButton = screen.getByTitle('All Calls');
      expect(allCallsButton.className).toContain('focus-visible:ring-2');
      expect(allCallsButton.className).toContain('focus-visible:ring-vibe-orange');
      expect(allCallsButton.className).toContain('focus-visible:ring-offset-2');
    });
  });

  describe('bottom utility buttons', () => {
    it('should render Take the tour button', () => {
      renderWithRouter({ isCollapsed: false });

      expect(screen.getByText('Take the tour')).toBeInTheDocument();
    });

    it('should render How it works button', () => {
      renderWithRouter({ isCollapsed: false });

      expect(screen.getByText('How it works')).toBeInTheDocument();
    });
  });
});
