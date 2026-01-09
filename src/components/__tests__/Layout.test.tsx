import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Layout } from '../Layout';

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
  });

  const renderWithRouter = (children: React.ReactNode, initialEntries: string[] = ['/']) => {
    return render(
      <MemoryRouter initialEntries={initialEntries}>
        <Layout>{children}</Layout>
      </MemoryRouter>
    );
  };

  describe('page label rendering', () => {
    it('should render HOME label for root path', () => {
      renderWithRouter(<div>Content</div>, ['/']);

      const topBar = screen.getByTestId('top-bar');
      expect(topBar).toHaveAttribute('data-page-label', 'HOME');
    });

    it('should render AI CHAT label for /chat path', () => {
      renderWithRouter(<div>Content</div>, ['/chat']);

      const topBar = screen.getByTestId('top-bar');
      expect(topBar).toHaveAttribute('data-page-label', 'AI CHAT');
    });

    it('should render SORTING & TAGGING label for /sorting-tagging path', () => {
      renderWithRouter(<div>Content</div>, ['/sorting-tagging']);

      const topBar = screen.getByTestId('top-bar');
      expect(topBar).toHaveAttribute('data-page-label', 'SORTING & TAGGING');
    });

    it('should render SETTINGS label for /settings path', () => {
      renderWithRouter(<div>Content</div>, ['/settings']);

      const topBar = screen.getByTestId('top-bar');
      expect(topBar).toHaveAttribute('data-page-label', 'SETTINGS');
    });

    it('should render SETTINGS label for /settings subpaths', () => {
      renderWithRouter(<div>Content</div>, ['/settings/account']);

      const topBar = screen.getByTestId('top-bar');
      expect(topBar).toHaveAttribute('data-page-label', 'SETTINGS');
    });

    it('should render HOME label for unknown paths', () => {
      renderWithRouter(<div>Content</div>, ['/unknown-path']);

      const topBar = screen.getByTestId('top-bar');
      expect(topBar).toHaveAttribute('data-page-label', 'HOME');
    });
  });

  describe('layout structure', () => {
    it('should render children content', () => {
      renderWithRouter(<div data-testid="child-content">Test Content</div>, ['/']);

      expect(screen.getByTestId('child-content')).toBeInTheDocument();
      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });

    it('should render TopBar component', () => {
      renderWithRouter(<div>Content</div>, ['/']);

      expect(screen.getByTestId('top-bar')).toBeInTheDocument();
    });

    it('should render main element', () => {
      renderWithRouter(<div>Content</div>, ['/']);

      expect(screen.getByRole('main')).toBeInTheDocument();
    });
  });

  describe('custom layout detection', () => {
    it('should use custom layout for chat pages', () => {
      const { container } = renderWithRouter(<div data-testid="chat-content">Chat</div>, ['/chat']);

      // Chat pages should NOT have the card wrapper
      const cardWrapper = container.querySelector('.bg-card.rounded-2xl');
      expect(cardWrapper).not.toBeInTheDocument();

      // Content should still be present
      expect(screen.getByTestId('chat-content')).toBeInTheDocument();
    });

    it('should use custom layout for chat subpaths', () => {
      const { container } = renderWithRouter(<div data-testid="chat-session">Session</div>, ['/chat/session-123']);

      // Chat subpaths should NOT have the card wrapper
      const cardWrapper = container.querySelector('.bg-card.rounded-2xl');
      expect(cardWrapper).not.toBeInTheDocument();

      expect(screen.getByTestId('chat-session')).toBeInTheDocument();
    });

    it('should use custom layout for root transcripts page', () => {
      const { container } = renderWithRouter(<div data-testid="transcripts">Transcripts</div>, ['/']);

      // Root path (transcripts) should NOT have the card wrapper
      const cardWrapper = container.querySelector('.bg-card.rounded-2xl');
      expect(cardWrapper).not.toBeInTheDocument();
    });

    it('should use custom layout for /transcripts path', () => {
      const { container } = renderWithRouter(<div data-testid="transcripts">Transcripts</div>, ['/transcripts']);

      // /transcripts path should NOT have the card wrapper
      const cardWrapper = container.querySelector('.bg-card.rounded-2xl');
      expect(cardWrapper).not.toBeInTheDocument();
    });

    it('should use custom layout for settings page', () => {
      const { container } = renderWithRouter(<div data-testid="settings-content">Settings</div>, ['/settings']);

      // Settings should NOT have the card wrapper (uses custom layout)
      const cardWrapper = container.querySelector('.bg-card.rounded-2xl');
      expect(cardWrapper).not.toBeInTheDocument();

      expect(screen.getByTestId('settings-content')).toBeInTheDocument();
    });

    it('should use custom layout for settings subpaths', () => {
      const { container } = renderWithRouter(<div data-testid="settings-account">Account</div>, ['/settings/account']);

      // Settings subpaths should NOT have the card wrapper (uses custom layout)
      const cardWrapper = container.querySelector('.bg-card.rounded-2xl');
      expect(cardWrapper).not.toBeInTheDocument();

      expect(screen.getByTestId('settings-account')).toBeInTheDocument();
    });

    it('should use custom layout for sorting-tagging page', () => {
      const { container } = renderWithRouter(<div data-testid="sorting-content">Sorting</div>, ['/sorting-tagging']);

      // Sorting & Tagging should NOT have the card wrapper (uses custom layout)
      const cardWrapper = container.querySelector('.bg-card.rounded-2xl');
      expect(cardWrapper).not.toBeInTheDocument();

      expect(screen.getByTestId('sorting-content')).toBeInTheDocument();
    });

    it('should use card wrapper for unknown pages', () => {
      const { container } = renderWithRouter(<div data-testid="unknown-content">Unknown</div>, ['/unknown-page']);

      // Unknown pages should have the card wrapper
      const cardWrapper = container.querySelector('.bg-card.rounded-2xl');
      expect(cardWrapper).toBeInTheDocument();

      expect(screen.getByTestId('unknown-content')).toBeInTheDocument();
    });
  });

  describe('container styling', () => {
    it('should have min-h-screen class on outer container', () => {
      const { container } = renderWithRouter(<div>Content</div>, ['/']);

      const outerDiv = container.firstChild as HTMLElement;
      expect(outerDiv).toHaveClass('min-h-screen');
    });

    it('should have w-full class on outer container', () => {
      const { container } = renderWithRouter(<div>Content</div>, ['/']);

      const outerDiv = container.firstChild as HTMLElement;
      expect(outerDiv).toHaveClass('w-full');
    });

    it('should have gradient background style', () => {
      const { container } = renderWithRouter(<div>Content</div>, ['/']);

      const outerDiv = container.firstChild as HTMLElement;
      expect(outerDiv.style.background).toContain('linear-gradient');
    });
  });

  describe('multiple children', () => {
    it('should render multiple children correctly', () => {
      renderWithRouter(
        <>
          <div data-testid="child-1">First</div>
          <div data-testid="child-2">Second</div>
          <div data-testid="child-3">Third</div>
        </>,
        ['/']
      );

      expect(screen.getByTestId('child-1')).toBeInTheDocument();
      expect(screen.getByTestId('child-2')).toBeInTheDocument();
      expect(screen.getByTestId('child-3')).toBeInTheDocument();
    });
  });
});
