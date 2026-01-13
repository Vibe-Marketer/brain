import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
      const dots = container.querySelectorAll('.bg-vibe-orange');
      expect(dots.length).toBeGreaterThan(0);
    });

    it('should show Home as active on /transcripts path', () => {
      const { container } = renderWithRouter({ isCollapsed: true }, ['/transcripts']);

      // Home should be active since /transcripts is in its matchPaths
      const dots = container.querySelectorAll('.bg-vibe-orange');
      expect(dots.length).toBeGreaterThan(0);
    });

    it('should show AI Chat as active on /chat path', () => {
      renderWithRouter({ isCollapsed: false }, ['/chat']);

      // In expanded mode, active items have gray background on button
      const chatButton = screen.getByTitle('AI Chat');
      expect(chatButton).toHaveClass('bg-gray-100');
    });

    it('should show Settings as active on /settings path', () => {
      renderWithRouter({ isCollapsed: false }, ['/settings']);

      const settingsButton = screen.getByTitle('Settings');
      expect(settingsButton).toHaveClass('bg-gray-100');
    });

    it('should show Sorting as active on /sorting-tagging path', () => {
      renderWithRouter({ isCollapsed: false }, ['/sorting-tagging']);

      const sortingButton = screen.getByTitle('Sorting');
      expect(sortingButton).toHaveClass('bg-gray-100');
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
      const indicatorDot = container.querySelector('.bg-vibe-orange.rounded-full');
      expect(indicatorDot).toBeInTheDocument();
    });

    it('should not show h-[60%] left-edge indicator in collapsed mode', () => {
      const { container } = renderWithRouter({ isCollapsed: true }, ['/']);

      // The h-[60%] left-edge indicator should not be present in collapsed mode
      const leftIndicator = container.querySelector('.bg-vibe-orange.h-\\[60\\%\\]');
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
      // Active items have gray background in expanded mode
      expect(chatButton).toHaveClass('bg-gray-100');
    });

    it('should render active indicator with h-[60%] height in expanded mode', () => {
      const { container } = renderWithRouter({ isCollapsed: false }, ['/']);

      // Active indicator should have 60% height class
      const indicator = container.querySelector('.bg-vibe-orange.h-\\[60\\%\\]');
      expect(indicator).toBeInTheDocument();
    });

    it('should show active indicator with opacity-100 when item is active', () => {
      const { container } = renderWithRouter({ isCollapsed: false }, ['/chat']);

      // Find the active indicator with visible state classes
      const activeIndicators = container.querySelectorAll('.bg-vibe-orange.opacity-100.scale-y-100');
      expect(activeIndicators.length).toBeGreaterThan(0);
    });

    it('should have inactive indicators with opacity-0 for non-active items', () => {
      const { container } = renderWithRouter({ isCollapsed: false }, ['/chat']);

      // Find inactive indicators with hidden state classes
      const inactiveIndicators = container.querySelectorAll('.bg-vibe-orange.opacity-0.scale-y-0');
      expect(inactiveIndicators.length).toBeGreaterThan(0);
    });

    it('should have transition classes on indicator for smooth animation', () => {
      const { container } = renderWithRouter({ isCollapsed: false }, ['/']);

      // Indicator should have transition classes
      const indicator = container.querySelector('.bg-vibe-orange.transition-all.duration-200');
      expect(indicator).toBeInTheDocument();
    });

    it('should have rounded-full class on indicator for pill shape', () => {
      const { container } = renderWithRouter({ isCollapsed: false }, ['/']);

      // Indicator should have fully rounded pill shape
      const indicator = container.querySelector('.bg-vibe-orange.rounded-full');
      expect(indicator).toBeInTheDocument();
    });
  });

  describe('optional callbacks', () => {
    it('should render sync button when onSyncClick is provided', () => {
      const onSyncClick = vi.fn();
      renderWithRouter({ onSyncClick });

      expect(screen.getByTitle('Sync & Import')).toBeInTheDocument();
    });

    it('should call onSyncClick when sync button is clicked', () => {
      const onSyncClick = vi.fn();
      renderWithRouter({ onSyncClick });

      fireEvent.click(screen.getByTitle('Sync & Import'));
      expect(onSyncClick).toHaveBeenCalledTimes(1);
    });

    it('should not render sync button when onSyncClick is not provided', () => {
      renderWithRouter();

      expect(screen.queryByTitle('Sync & Import')).not.toBeInTheDocument();
    });

    it('should render library toggle button when onLibraryToggle is provided', () => {
      const onLibraryToggle = vi.fn();
      renderWithRouter({ onLibraryToggle });

      expect(screen.getByTitle('Toggle Library Panel')).toBeInTheDocument();
    });

    it('should call onLibraryToggle when library button is clicked', () => {
      const onLibraryToggle = vi.fn();
      renderWithRouter({ onLibraryToggle });

      fireEvent.click(screen.getByTitle('Toggle Library Panel'));
      expect(onLibraryToggle).toHaveBeenCalledTimes(1);
    });

    it('should not render library toggle button when onLibraryToggle is not provided', () => {
      renderWithRouter();

      expect(screen.queryByTitle('Toggle Library Panel')).not.toBeInTheDocument();
    });

    it('should render both optional buttons when both callbacks are provided', () => {
      const onSyncClick = vi.fn();
      const onLibraryToggle = vi.fn();
      renderWithRouter({ onSyncClick, onLibraryToggle });

      expect(screen.getByTitle('Sync & Import')).toBeInTheDocument();
      expect(screen.getByTitle('Toggle Library Panel')).toBeInTheDocument();
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
      // Active state is indicated by gray background on button
      expect(chatButton).toHaveClass('bg-gray-100');
    });

    it('should match subpaths for settings', () => {
      renderWithRouter({ isCollapsed: false }, ['/settings/profile']);

      const settingsButton = screen.getByTitle('Settings');
      expect(settingsButton).toHaveClass('bg-gray-100');
    });

    it('should not match unrelated paths', () => {
      renderWithRouter({ isCollapsed: false }, ['/unknown-path']);

      const homeButton = screen.getByTitle('Home');
      const chatButton = screen.getByTitle('AI Chat');
      const sortingButton = screen.getByTitle('Sorting');
      const settingsButton = screen.getByTitle('Settings');

      // None of these should be marked as active for an unknown path
      // Active state is shown via gray background class
      expect(homeButton).not.toHaveClass('bg-gray-100');
      expect(chatButton).not.toHaveClass('bg-gray-100');
      expect(sortingButton).not.toHaveClass('bg-gray-100');
      expect(settingsButton).not.toHaveClass('bg-gray-100');
    });
  });

  describe('icon variant rendering', () => {
    it('should render icon with vibe-orange color when active in expanded mode', () => {
      const { container } = renderWithRouter({ isCollapsed: false }, ['/']);

      // Active icon should have vibe-orange text color
      const activeIcon = container.querySelector('.text-vibe-orange');
      expect(activeIcon).toBeInTheDocument();
    });

    it('should render icon with muted-foreground color when inactive in expanded mode', () => {
      const { container } = renderWithRouter({ isCollapsed: false }, ['/chat']);

      // Home is inactive when on /chat path, should have muted color
      const homeButton = screen.getByTitle('Home');
      const homeIcon = homeButton.querySelector('.text-muted-foreground');
      expect(homeIcon).toBeInTheDocument();
    });

    it('should render multiple inactive icons with muted color', () => {
      const { container } = renderWithRouter({ isCollapsed: false }, ['/']);

      // Only Home is active, other items should have muted icons
      const mutedIcons = container.querySelectorAll('.text-muted-foreground');
      // Should have at least 3 muted icons (AI Chat, Sorting, Settings when Home is active)
      expect(mutedIcons.length).toBeGreaterThanOrEqual(3);
    });

    it('should have orange ring on active NavIcon in collapsed mode', () => {
      const { container } = renderWithRouter({ isCollapsed: true }, ['/']);

      // Active NavIcon should have ring-vibe-orange class (via ring-2 ring-vibe-orange/50)
      const activeNavIconWrapper = container.querySelector('.ring-vibe-orange\\/50');
      expect(activeNavIconWrapper).toBeInTheDocument();
    });

    it('should not have orange ring on inactive NavIcon in collapsed mode', () => {
      const { container } = renderWithRouter({ isCollapsed: true }, ['/']);

      // Count elements with ring styling - only active item should have it
      const ringElements = container.querySelectorAll('.ring-vibe-orange\\/50');
      expect(ringElements.length).toBe(1);
    });

    it('should apply gray background on active item in expanded mode', () => {
      renderWithRouter({ isCollapsed: false }, ['/chat']);

      // Active button should have gray background
      const chatButton = screen.getByTitle('AI Chat');
      expect(chatButton).toHaveClass('bg-gray-100');
    });

    it('should not apply gray background on inactive items in expanded mode', () => {
      renderWithRouter({ isCollapsed: false }, ['/chat']);

      // Inactive buttons should not have gray background
      const homeButton = screen.getByTitle('Home');
      expect(homeButton).not.toHaveClass('bg-gray-100');
    });

    it('should render glossy 3D icon wrapper in collapsed mode', () => {
      const { container } = renderWithRouter({ isCollapsed: true });

      // NavIcon should have gradient background for glossy effect
      const glossyWrapper = container.querySelector('.bg-gradient-to-br.from-white.to-gray-200');
      expect(glossyWrapper).toBeInTheDocument();
    });

    it('should show active text color on label when active in expanded mode', () => {
      renderWithRouter({ isCollapsed: false }, ['/']);

      // Home label should have vibe-orange text
      const homeLabel = screen.getByText('Home');
      expect(homeLabel).toHaveClass('text-vibe-orange');
    });

    it('should show foreground text color on label when inactive in expanded mode', () => {
      renderWithRouter({ isCollapsed: false }, ['/chat']);

      // Home label should have default foreground text (not vibe-orange)
      const homeLabel = screen.getByText('Home');
      expect(homeLabel).toHaveClass('text-foreground');
      expect(homeLabel).not.toHaveClass('text-vibe-orange');
    });
  });

  describe('keyboard navigation', () => {
    it('should have navigation landmark with proper role and label', () => {
      renderWithRouter();

      const nav = screen.getByRole('navigation', { name: 'Main navigation' });
      expect(nav).toBeInTheDocument();
    });

    it('should move focus to next item on ArrowDown', async () => {
      renderWithRouter();
      const user = userEvent.setup();

      const homeButton = screen.getByTitle('Home');
      const chatButton = screen.getByTitle('AI Chat');

      // Focus Home button and press ArrowDown
      homeButton.focus();
      expect(document.activeElement).toBe(homeButton);

      await user.keyboard('{ArrowDown}');
      expect(document.activeElement).toBe(chatButton);
    });

    it('should move focus to previous item on ArrowUp', async () => {
      renderWithRouter();
      const user = userEvent.setup();

      const homeButton = screen.getByTitle('Home');
      const chatButton = screen.getByTitle('AI Chat');

      // Focus AI Chat button and press ArrowUp
      chatButton.focus();
      expect(document.activeElement).toBe(chatButton);

      await user.keyboard('{ArrowUp}');
      expect(document.activeElement).toBe(homeButton);
    });

    it('should wrap focus to first item when pressing ArrowDown on last item', async () => {
      renderWithRouter();
      const user = userEvent.setup();

      const homeButton = screen.getByTitle('Home');
      const settingsButton = screen.getByTitle('Settings');

      // Focus Settings (last item) and press ArrowDown
      settingsButton.focus();
      expect(document.activeElement).toBe(settingsButton);

      await user.keyboard('{ArrowDown}');
      expect(document.activeElement).toBe(homeButton);
    });

    it('should wrap focus to last item when pressing ArrowUp on first item', async () => {
      renderWithRouter();
      const user = userEvent.setup();

      const homeButton = screen.getByTitle('Home');
      const settingsButton = screen.getByTitle('Settings');

      // Focus Home (first item) and press ArrowUp
      homeButton.focus();
      expect(document.activeElement).toBe(homeButton);

      await user.keyboard('{ArrowUp}');
      expect(document.activeElement).toBe(settingsButton);
    });

    it('should move focus to first item on Home key', async () => {
      renderWithRouter();
      const user = userEvent.setup();

      const homeButton = screen.getByTitle('Home');
      const settingsButton = screen.getByTitle('Settings');

      // Focus Settings and press Home key
      settingsButton.focus();
      await user.keyboard('{Home}');
      expect(document.activeElement).toBe(homeButton);
    });

    it('should move focus to last item on End key', async () => {
      renderWithRouter();
      const user = userEvent.setup();

      const homeButton = screen.getByTitle('Home');
      const settingsButton = screen.getByTitle('Settings');

      // Focus Home and press End key
      homeButton.focus();
      await user.keyboard('{End}');
      expect(document.activeElement).toBe(settingsButton);
    });

    it('should navigate on Enter key press', async () => {
      renderWithRouter();
      const user = userEvent.setup();

      const chatButton = screen.getByTitle('AI Chat');

      // Focus AI Chat and press Enter
      chatButton.focus();
      await user.keyboard('{Enter}');

      expect(mockNavigate).toHaveBeenCalledWith('/chat');
    });

    it('should navigate on Space key press', async () => {
      renderWithRouter();
      const user = userEvent.setup();

      const sortingButton = screen.getByTitle('Sorting');

      // Focus Sorting and press Space
      sortingButton.focus();
      await user.keyboard(' ');

      expect(mockNavigate).toHaveBeenCalledWith('/sorting-tagging');
    });

    it('should have visible focus ring with vibe-orange color', () => {
      renderWithRouter();

      const homeButton = screen.getByTitle('Home');
      // Button should have focus-visible ring classes with vibe-orange
      expect(homeButton.className).toContain('focus-visible:ring-2');
      expect(homeButton.className).toContain('focus-visible:ring-vibe-orange');
      expect(homeButton.className).toContain('focus-visible:ring-offset-2');
    });

    it('should support Tab navigation between buttons', async () => {
      renderWithRouter();
      const user = userEvent.setup();

      const homeButton = screen.getByTitle('Home');
      const chatButton = screen.getByTitle('AI Chat');

      // Tab to first button
      await user.tab();
      expect(document.activeElement).toBe(homeButton);

      // Tab to next button
      await user.tab();
      expect(document.activeElement).toBe(chatButton);
    });

    it('should call onSettingsClick callback when Settings is activated via Enter', async () => {
      const onSettingsClick = vi.fn();
      renderWithRouter({ onSettingsClick });
      const user = userEvent.setup();

      const settingsButton = screen.getByTitle('Settings');
      settingsButton.focus();
      await user.keyboard('{Enter}');

      expect(mockNavigate).toHaveBeenCalledWith('/settings');
      expect(onSettingsClick).toHaveBeenCalledTimes(1);
    });

    it('should call onSortingClick callback when Sorting is activated via Enter', async () => {
      const onSortingClick = vi.fn();
      renderWithRouter({ onSortingClick });
      const user = userEvent.setup();

      const sortingButton = screen.getByTitle('Sorting');
      sortingButton.focus();
      await user.keyboard('{Enter}');

      expect(mockNavigate).toHaveBeenCalledWith('/sorting-tagging');
      expect(onSortingClick).toHaveBeenCalledTimes(1);
    });
  });
});
