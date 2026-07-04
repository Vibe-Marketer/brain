import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';

vi.mock('@/hooks/useBreakpoint', () => ({
  useBreakpointFlags: () => ({
    isMobile: true,
    isTablet: false,
    isDesktop: false,
    isMobileOrTablet: true,
    isTabletOrDesktop: false,
  }),
}));

vi.mock('@/components/ui/sidebar-nav', () => ({
  SidebarNav: () => <div data-testid="mobile-sidebar-nav">Navigation items</div>,
}));

describe('AppShell mobile layout', () => {
  it('keeps one bottom nav bar and exposes pane shortcuts from More', () => {
    render(
      <MemoryRouter>
        <AppShell
          config={{
            secondaryPane: <div>Secondary content</div>,
            secondaryPaneTitle: 'Library',
            detailPane: <div>Detail content</div>,
          }}
        >
          <div>Main pane content</div>
        </AppShell>
      </MemoryRouter>,
    );

    expect(screen.getByText('Main pane content')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Mobile primary navigation' })).toBeInTheDocument();
    expect(screen.queryByRole('toolbar', { name: 'Mobile pane controls' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go to Calls' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go to Import' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go to Rules' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go to People' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open more navigation' }));
    expect(screen.getByTestId('mobile-sidebar-nav')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Pane shortcuts' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open Library pane' }));
    expect(screen.getByText('Secondary content')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open more navigation' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open detail pane' }));
    expect(screen.getByText('Detail content')).toBeInTheDocument();
  });
});
