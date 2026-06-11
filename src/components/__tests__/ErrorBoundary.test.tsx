import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { ErrorBoundary } from '../ErrorBoundary';

// ErrorBoundary fans out to Sentry, the DebugPanel, and the logger on catch.
// Stub them so the test isolates the stale-deploy reload behaviour.
vi.mock('@sentry/react', () => ({ captureException: vi.fn() }));
vi.mock('@/components/debug-panel', () => ({ debugLog: vi.fn() }));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const RELOAD_GUARD_KEY = 'cv:chunk-reload-ts';

function Boom({ error }: { error: Error }): JSX.Element {
  throw error;
}

function chunkError(message: string): Error {
  const err = new Error(message);
  return err;
}

let reloadMock: ReturnType<typeof vi.fn>;
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
let originalLocation: Location;

beforeEach(() => {
  sessionStorage.clear();
  reloadMock = vi.fn();
  // jsdom's window.location is non-configurable and its reload() throws
  // "Not implemented", so swap the whole object out for one carrying a spy.
  originalLocation = window.location;
  delete (window as unknown as { location?: Location }).location;
  (window as unknown as { location: unknown }).location = {
    ...originalLocation,
    href: originalLocation.href,
    reload: reloadMock,
  };
  // React + ErrorBoundary both log caught errors; keep test output quiet.
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  (window as unknown as { location: Location }).location = originalLocation;
  consoleErrorSpy.mockRestore();
});

describe('ErrorBoundary stale-deploy recovery', () => {
  it('performs a one-shot reload on a fetch-style dynamic import failure', () => {
    render(
      <ErrorBoundary>
        <Boom error={chunkError('Failed to fetch dynamically imported module: https://x/assets/a.js')} />
      </ErrorBoundary>
    );

    expect(reloadMock).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(RELOAD_GUARD_KEY)).toBeTruthy();
  });

  it('detects the Chrome module-script MIME failure and reloads', () => {
    render(
      <ErrorBoundary>
        <Boom
          error={chunkError(
            'Failed to load module script: Expected a JavaScript module script but the server responded with a MIME type of "text/html".'
          )}
        />
      </ErrorBoundary>
    );

    expect(reloadMock).toHaveBeenCalledTimes(1);
  });

  it('does not reload again if a reload just happened (loop guard)', () => {
    // Simulate a reload that occurred moments ago — still inside the guard window.
    sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));

    render(
      <ErrorBoundary>
        <Boom error={chunkError('Failed to fetch dynamically imported module: https://x/assets/a.js')} />
      </ErrorBoundary>
    );

    expect(reloadMock).not.toHaveBeenCalled();
  });

  it('reloads again once the guard window has elapsed (later deploy)', () => {
    // A stale guard timestamp well outside the window should not block recovery.
    sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now() - 60_000));

    render(
      <ErrorBoundary>
        <Boom error={chunkError('Importing a module script failed.')} />
      </ErrorBoundary>
    );

    expect(reloadMock).toHaveBeenCalledTimes(1);
  });

  it('does not reload for a non-chunk runtime error', () => {
    render(
      <ErrorBoundary>
        <Boom error={chunkError('Cannot read properties of undefined (reading foo)')} />
      </ErrorBoundary>
    );

    expect(reloadMock).not.toHaveBeenCalled();
  });
});
