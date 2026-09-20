import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
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

function LocationProbe() {
  return <div data-testid="location-path">{useLocation().pathname}</div>;
}

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
          <LocationProbe />
        </AppShell>
      </MemoryRouter>,
    );

    expect(screen.getByText('Main pane content')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Mobile primary navigation' })).toBeInTheDocument();
    expect(screen.queryByRole('toolbar', { name: 'Mobile pane controls' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go to Calls' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go to Events' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go to Import' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go to Rules' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go to People' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open more navigation' }));
    expect(screen.getByText('Secondary content')).toBeInTheDocument();
    expect(screen.queryByTestId('mobile-sidebar-nav')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open more navigation' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open detail pane' }));
    expect(screen.getByText('Detail content')).toBeInTheDocument();
  });

  it('places Events immediately after Calls and exposes its active route', () => {
    render(
      <MemoryRouter initialEntries={['/events']}>
        <AppShell>
          <div>Main pane content</div>
          <LocationProbe />
        </AppShell>
      </MemoryRouter>,
    );

    const nav = screen.getByRole('navigation', { name: 'Mobile primary navigation' });
    const buttons = within(nav).getAllByRole('button');
    expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual([
      'Go to Calls',
      'Go to Events',
      'Go to Import',
      'Go to Rules',
      'Go to People',
      'Open more navigation',
    ]);
    expect(within(nav).getByRole('button', { name: 'Go to Events' })).toHaveAttribute('aria-current', 'page');

    fireEvent.click(within(nav).getByRole('button', { name: 'Go to Calls' }));
    expect(screen.getByTestId('location-path')).toHaveTextContent('/');
  });
});
