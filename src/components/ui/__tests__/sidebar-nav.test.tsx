import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SidebarNav } from '../sidebar-nav';

// Mock useNavigate from react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('SidebarNav', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderWithRouter = (
    props: React.ComponentProps<typeof SidebarNav> = {},
    initialEntries: string[] = ['/']
  ) => {
    return render(
      <MemoryRouter initialEntries={initialEntries}>
        <SidebarNav {...props} />
      </MemoryRouter>
    );
  };

  describe('rendering', () => {
    it('should render all navigation items', () => {
      renderWithRouter();

      expect(screen.getByTitle('Home')).toBeInTheDocument();
      expect(screen.getByTitle('AI Chat')).toBeInTheDocument();
      expect(screen.getByTitle('Sorting')).toBeInTheDocument();
      expect(screen.getByTitle('Settings')).toBeInTheDocument();
    });

    it('should render labels in expanded mode', () => {
      renderWithRouter({ isCollapsed: false });

      expect(screen.getByText('Home')).toBeInTheDocument();
      expect(screen.getByText('AI Chat')).toBeInTheDocument();
      expect(screen.getByText('Sorting')).toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    it('should not render labels in collapsed mode', () => {
      renderWithRouter({ isCollapsed: true });

      // Labels should not be visible in collapsed mode
      expect(screen.queryByText('Home')).not.toBeInTheDocument();
      expect(screen.queryByText('AI Chat')).not.toBeInTheDocument();
      expect(screen.queryByText('Sorting')).not.toBeInTheDocument();
      expect(screen.queryByText('Settings')).not.toBeInTheDocument();
    });

    it('should render separator line', () => {
      const { container } = renderWithRouter();

      const separator = container.querySelector('.border-t.border-cb-border');
      expect(separator).toBeInTheDocument();
    });
  });

  describe('navigation', () => {
    it('should navigate to home on Home click', () => {
      renderWithRouter();

      fireEvent.click(screen.getByTitle('Home'));
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });

    it('should navigate to chat on AI Chat click', () => {
      renderWithRouter();

      fireEvent.click(screen.getByTitle('AI Chat'));
      expect(mockNavigate).toHaveBeenCalledWith('/chat');
    });

    it('should navigate to sorting on Sorting click', () => {
      renderWithRouter();

      fireEvent.click(screen.getByTitle('Sorting'));
      expect(mockNavigate).toHaveBeenCalledWith('/sorting-tagging');
    });

    it('should navigate to settings on Settings click', () => {
      renderWithRouter();

      fireEvent.click(screen.getByTitle('Settings'));
      expect(mockNavigate).toHaveBeenCalledWith('/settings');
    });
  });

  describe('active state', () => {
    it('should show Home as active on root path', () => {
      const { container } = renderWithRouter({ isCollapsed: true }, ['/']);

      // In collapsed mode, active items have an orange indicator dot
      const dots = container.querySelectorAll('.bg-cb-vibe-orange');
      expect(dots.length).toBeGreaterThan(0);
    });

    it('should show Home as active on /transcripts path', () => {
      const { container } = renderWithRouter({ isCollapsed: true }, ['/transcripts']);

      // Home should be active since /transcripts is in its matchPaths
      const dots = container.querySelectorAll('.bg-cb-vibe-orange');
      expect(dots.length).toBeGreaterThan(0);
    });

    it('should show AI Chat as active on /chat path', () => {
      renderWithRouter({ isCollapsed: false }, ['/chat']);

      // In expanded mode, active items have font-semibold class
      const chatButton = screen.getByTitle('AI Chat');
      expect(chatButton).toHaveClass('font-semibold');
    });

    it('should show Settings as active on /settings path', () => {
      renderWithRouter({ isCollapsed: false }, ['/settings']);

      const settingsButton = screen.getByTitle('Settings');
      expect(settingsButton).toHaveClass('font-semibold');
    });

    it('should show Sorting as active on /sorting-tagging path', () => {
      renderWithRouter({ isCollapsed: false }, ['/sorting-tagging']);

      const sortingButton = screen.getByTitle('Sorting');
      expect(sortingButton).toHaveClass('font-semibold');
    });
  });

  describe('collapsed mode', () => {
    it('should apply vertical layout in collapsed mode', () => {
      const { container } = renderWithRouter({ isCollapsed: true });

      const navContainer = container.querySelector('.flex-col.items-center');
      expect(navContainer).toBeInTheDocument();
    });

    it('should show active indicator dot in collapsed mode', () => {
      const { container } = renderWithRouter({ isCollapsed: true }, ['/']);

      // Active indicator dot should be present
      const indicatorDot = container.querySelector('.bg-cb-vibe-orange.rounded-full');
      expect(indicatorDot).toBeInTheDocument();
    });

    it('should not show h-[80%] left-edge indicator in collapsed mode', () => {
      const { container } = renderWithRouter({ isCollapsed: true }, ['/']);

      // The h-[80%] left-edge indicator should not be present in collapsed mode
      const leftIndicator = container.querySelector('.bg-cb-vibe-orange.h-\\[80\\%\\]');
      expect(leftIndicator).not.toBeInTheDocument();
    });

    it('should not show separator between main items in collapsed mode', () => {
      const { container } = renderWithRouter({ isCollapsed: true });

      // The separator div with .bg-border.my-2 should not be present in collapsed mode
      const separator = container.querySelector('.bg-border.my-2');
      expect(separator).not.toBeInTheDocument();
    });
  });

  describe('expanded mode', () => {
    it('should apply horizontal layout in expanded mode', () => {
      const { container } = renderWithRouter({ isCollapsed: false });

      const navContainer = container.querySelector('.flex-col.items-stretch');
      expect(navContainer).toBeInTheDocument();
    });

    it('should show separator in expanded mode', () => {
      const { container } = renderWithRouter({ isCollapsed: false });

      // The internal separator should be visible in expanded mode
      const separator = container.querySelector('.bg-border.my-2');
      expect(separator).toBeInTheDocument();
    });

    it('should apply active background styling in expanded mode', () => {
      renderWithRouter({ isCollapsed: false }, ['/chat']);

      const chatButton = screen.getByTitle('AI Chat');
      expect(chatButton).toHaveClass('bg-gray-100');
    });

    it('should render active indicator with h-[80%] height in expanded mode', () => {
      const { container } = renderWithRouter({ isCollapsed: false }, ['/']);

      // Active indicator should have 80% height class
      const indicator = container.querySelector('.bg-cb-vibe-orange.h-\\[80\\%\\]');
      expect(indicator).toBeInTheDocument();
    });

    it('should show active indicator with opacity-100 when item is active', () => {
      const { container } = renderWithRouter({ isCollapsed: false }, ['/chat']);

      // Find the active indicator with visible state classes
      const activeIndicators = container.querySelectorAll('.bg-cb-vibe-orange.opacity-100.scale-y-100');
      expect(activeIndicators.length).toBeGreaterThan(0);
    });

    it('should have inactive indicators with opacity-0 for non-active items', () => {
      const { container } = renderWithRouter({ isCollapsed: false }, ['/chat']);

      // Find inactive indicators with hidden state classes
      const inactiveIndicators = container.querySelectorAll('.bg-cb-vibe-orange.opacity-0.scale-y-0');
      expect(inactiveIndicators.length).toBeGreaterThan(0);
    });

    it('should have transition classes on indicator for smooth animation', () => {
      const { container } = renderWithRouter({ isCollapsed: false }, ['/']);

      // Indicator should have transition classes
      const indicator = container.querySelector('.bg-cb-vibe-orange.transition-all.duration-200');
      expect(indicator).toBeInTheDocument();
    });

    it('should have rounded-r-full class on indicator for pill shape', () => {
      const { container } = renderWithRouter({ isCollapsed: false }, ['/']);

      // Indicator should have rounded right edge
      const indicator = container.querySelector('.bg-cb-vibe-orange.rounded-r-full');
      expect(indicator).toBeInTheDocument();
    });
  });

  describe('optional callbacks', () => {
    it('should render sync button when onSyncClick is provided', () => {
      const onSyncClick = vi.fn();
      renderWithRouter({ onSyncClick });

      expect(screen.getByTitle('Sync / Import')).toBeInTheDocument();
    });

    it('should call onSyncClick when sync button is clicked', () => {
      const onSyncClick = vi.fn();
      renderWithRouter({ onSyncClick });

      fireEvent.click(screen.getByTitle('Sync / Import'));
      expect(onSyncClick).toHaveBeenCalledTimes(1);
    });

    it('should not render sync button when onSyncClick is not provided', () => {
      renderWithRouter();

      expect(screen.queryByTitle('Sync / Import')).not.toBeInTheDocument();
    });

    it('should render library toggle button when onLibraryToggle is provided', () => {
      const onLibraryToggle = vi.fn();
      renderWithRouter({ onLibraryToggle });

      expect(screen.getByTitle('Toggle Library')).toBeInTheDocument();
    });

    it('should call onLibraryToggle when library button is clicked', () => {
      const onLibraryToggle = vi.fn();
      renderWithRouter({ onLibraryToggle });

      fireEvent.click(screen.getByTitle('Toggle Library'));
      expect(onLibraryToggle).toHaveBeenCalledTimes(1);
    });

    it('should not render library toggle button when onLibraryToggle is not provided', () => {
      renderWithRouter();

      expect(screen.queryByTitle('Toggle Library')).not.toBeInTheDocument();
    });

    it('should render both optional buttons when both callbacks are provided', () => {
      const onSyncClick = vi.fn();
      const onLibraryToggle = vi.fn();
      renderWithRouter({ onSyncClick, onLibraryToggle });

      expect(screen.getByTitle('Sync / Import')).toBeInTheDocument();
      expect(screen.getByTitle('Toggle Library')).toBeInTheDocument();
    });

    it('should show Sync & Import label in expanded mode', () => {
      const onSyncClick = vi.fn();
      renderWithRouter({ onSyncClick, isCollapsed: false });

      expect(screen.getByText('Sync & Import')).toBeInTheDocument();
    });

    it('should show Library Panel label in expanded mode', () => {
      const onLibraryToggle = vi.fn();
      renderWithRouter({ onLibraryToggle, isCollapsed: false });

      expect(screen.getByText('Library Panel')).toBeInTheDocument();
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

      expect(screen.getByTitle('Home')).toBeInTheDocument();
      expect(screen.getByTitle('AI Chat')).toBeInTheDocument();
      expect(screen.getByTitle('Sorting')).toBeInTheDocument();
      expect(screen.getByTitle('Settings')).toBeInTheDocument();
    });

    it('should have focus-visible styling classes on buttons', () => {
      renderWithRouter();

      const homeButton = screen.getByTitle('Home');
      expect(homeButton.className).toContain('focus-visible:ring-2');
    });
  });

  describe('path matching', () => {
    it('should match subpaths for chat', () => {
      renderWithRouter({ isCollapsed: false }, ['/chat/session-123']);

      const chatButton = screen.getByTitle('AI Chat');
      expect(chatButton).toHaveClass('font-semibold');
    });

    it('should match subpaths for settings', () => {
      renderWithRouter({ isCollapsed: false }, ['/settings/profile']);

      const settingsButton = screen.getByTitle('Settings');
      expect(settingsButton).toHaveClass('font-semibold');
    });

    it('should not match unrelated paths', () => {
      renderWithRouter({ isCollapsed: false }, ['/unknown-path']);

      const homeButton = screen.getByTitle('Home');
      const chatButton = screen.getByTitle('AI Chat');
      const sortingButton = screen.getByTitle('Sorting');
      const settingsButton = screen.getByTitle('Settings');

      // None of these should be marked as active for an unknown path
      expect(homeButton).not.toHaveClass('font-semibold');
      expect(chatButton).not.toHaveClass('font-semibold');
      expect(sortingButton).not.toHaveClass('font-semibold');
      expect(settingsButton).not.toHaveClass('font-semibold');
    });
  });
});
