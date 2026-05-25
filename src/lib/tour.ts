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
import type { DriveStep } from 'driver.js';

const TOUR_COMPLETED_KEY = 'callvault_tour_completed';

function isVisible(selector: string): boolean {
  const element = document.querySelector(selector);
  if (!(element instanceof HTMLElement)) return false;

  const rect = element.getBoundingClientRect();
  const styles = window.getComputedStyle(element);

  return (
    rect.width > 0 &&
    rect.height > 0 &&
    styles.display !== 'none' &&
    styles.visibility !== 'hidden' &&
    styles.opacity !== '0'
  );
}

const productTourSteps: DriveStep[] = [
  {
    popover: {
      title: 'CallVault tour',
      description:
        '<p>A quick pass through the core workspace: calls, search, imports, automation, and account controls.</p>',
      side: 'over',
      align: 'center',
    },
  },
  {
    element: '[data-tour="nav-all-calls"]',
    popover: {
      title: 'Calls',
      description:
        '<p>Your synced and uploaded recordings live here, with transcripts, summaries, filters, and tags in one workspace.</p>',
      side: 'right',
      align: 'start',
    },
  },
  {
    element: '[data-tour="topbar-search"]',
    popover: {
      title: 'Search',
      description:
        '<p>Open global search to find people, keywords, and moments across every transcript without leaving the page.</p>',
      side: 'bottom',
      align: 'end',
    },
  },
  {
    element: '[data-tour="nav-import"]',
    popover: {
      title: 'Import',
      description:
        '<p>Connect meeting sources or upload files directly. New recordings can flow into your library automatically.</p>',
      side: 'right',
      align: 'start',
    },
  },
  {
    element: '[data-tour="nav-rules"]',
    popover: {
      title: 'Rules',
      description:
        '<p>Create routing rules that tag and organize incoming calls by source, speaker, keyword, duration, or meeting type.</p>',
      side: 'right',
      align: 'start',
    },
  },
  {
    element: '[data-tour="nav-people"]',
    popover: {
      title: 'People',
      description:
        '<p>Keep contacts and team context close to the calls they appear in, so follow-up stays tied to real conversations.</p>',
      side: 'right',
      align: 'start',
    },
  },
  {
    element: '[data-tour="nav-settings"]',
    popover: {
      title: 'Settings',
      description:
        '<p>Manage integrations, teammates, workspaces, and account preferences from the bottom of the navigation.</p>',
      side: 'right',
      align: 'end',
    },
  },
];

function getAvailableTourSteps(): DriveStep[] {
  return productTourSteps.filter((step) => {
    if (!step.element || typeof step.element !== 'string') return true;
    return isVisible(step.element);
  });
}

export function createTour() {
  const driverInstance = driver({
    animate: true,
    smoothScroll: true,
    overlayColor: '#050505',
    overlayOpacity: 0.52,
    stagePadding: 10,
    stageRadius: 12,
    popoverOffset: 14,
    allowClose: true,
    overlayClickBehavior: 'nextStep',
    disableActiveInteraction: true,
    doneBtnText: 'Done',
    nextBtnText: 'Next',
    prevBtnText: 'Back',
    showButtons: ['next', 'previous', 'close'],
    showProgress: true,
    progressText: '{{current}} / {{total}}',
    allowKeyboardControl: true,
    popoverClass: 'callvault-tour-popover',
    onDestroyed: () => {
      // Mark tour as completed in localStorage
      localStorage.setItem(TOUR_COMPLETED_KEY, 'true');
    },
  });

  driverInstance.setSteps(getAvailableTourSteps());

  return driverInstance;
}

export function startTour(): void {
  const steps = getAvailableTourSteps();
  if (steps.length <= 1) {
    console.warn('[Tour] Required navigation elements not found in DOM - tour aborted.');
    return;
  }

  const driverInstance = createTour();
  driverInstance.setSteps(steps);
  driverInstance.drive();
}

export function hasTourCompleted(): boolean {
  return localStorage.getItem(TOUR_COMPLETED_KEY) === 'true';
}

export function resetTour(): void {
  localStorage.removeItem(TOUR_COMPLETED_KEY);
}
