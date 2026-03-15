/**
 * Product Tour
 *
 * Uses driver.js v1 to guide new users through key app features.
 * The tour is triggered after onboarding completes and can be
 * re-launched at any time via the sidebar "?" button.
 *
 * driver.js v1 API:
 *   - driver(config)  — creates a Driver instance (no `new`)
 *   - .setSteps([])   — defines the tour steps
 *   - .drive()        — starts from step 0
 *   - .destroy()      — stops and cleans up
 */

import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

const TOUR_COMPLETED_KEY = 'callvault_tour_completed';

export function createTour() {
  const driverInstance = driver({
    animate: true,
    overlayOpacity: 0.65,
    stagePadding: 8,
    allowClose: true,
    doneBtnText: 'Done',
    nextBtnText: 'Next →',
    prevBtnText: '← Back',
    showButtons: ['next', 'previous', 'close'],
    allowKeyboardControl: true,
    popoverClass: 'callvault-tour-popover',
    onDestroyed: () => {
      // Mark tour as completed in localStorage
      localStorage.setItem(TOUR_COMPLETED_KEY, 'true');
    },
  });

  driverInstance.setSteps([
    {
      element: '[data-tour="nav-all-calls"]',
      popover: {
        title: 'Your Call Library',
        description:
          'Every recording you sync or upload lives here. Search transcripts, filter by date or tags, and open any call to read the full transcript and summary.',
        side: 'right',
        align: 'start',
      },
    },
    {
      element: '[data-tour="topbar-search"]',
      popover: {
        title: 'Search Everything',
        description:
          'Press <strong>⌘K</strong> (or Ctrl+K) to search across all your transcripts instantly. Find any moment from any call.',
        side: 'bottom',
        align: 'start',
      },
    },
    {
      element: '[data-tour="nav-import"]',
      popover: {
        title: 'Import & Sync Calls',
        description:
          'Connect Fathom, Zoom, or upload files directly. Once connected, new calls sync automatically so your library stays up to date.',
        side: 'right',
        align: 'start',
      },
    },
    {
      element: '[data-tour="nav-rules"]',
      popover: {
        title: 'Automate with Rules',
        description:
          'Set rules to automatically tag and organize calls as they come in — by speaker, keyword, duration, or meeting type. No manual sorting needed.',
        side: 'right',
        align: 'start',
      },
    },
    {
      element: '[data-tour="nav-settings"]',
      popover: {
        title: 'Settings & Team',
        description:
          'Manage your integrations, invite teammates, create workspaces to share calls, and configure your account.',
        side: 'right',
        align: 'start',
      },
    },
  ]);

  return driverInstance;
}

export function startTour(): void {
  // Don't start if nav elements aren't in the DOM yet
  const navEl = document.querySelector('[data-tour="nav-all-calls"]');
  if (!navEl) {
    console.warn('[Tour] Nav elements not found in DOM — tour aborted.');
    return;
  }

  const driverInstance = createTour();
  driverInstance.drive();
}

export function hasTourCompleted(): boolean {
  return localStorage.getItem(TOUR_COMPLETED_KEY) === 'true';
}

export function resetTour(): void {
  localStorage.removeItem(TOUR_COMPLETED_KEY);
}
