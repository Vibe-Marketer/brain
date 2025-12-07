/**
 * Screenshot Utility for Debug Panel
 *
 * Captures screenshots of the current page for debugging purposes.
 * Uses html2canvas-pro for cross-browser compatibility.
 */

import html2canvas from 'html2canvas-pro';

export interface ScreenshotOptions {
  quality?: number;
  format?: 'png' | 'jpeg' | 'webp';
  excludeElements?: string[]; // CSS selectors to exclude
  scale?: number;
  width?: number;
  height?: number;
  element?: HTMLElement; // Optional specific element to capture
}

export interface ScreenshotResult {
  dataUrl: string;
  blob: Blob;
  metadata: {
    timestamp: number;
    url: string;
    viewport: { width: number; height: number };
    userAgent: string;
  };
}

/**
 * Captures a screenshot of the current page with advanced options
 * Automatically handles hiding specified elements during capture
 */
export async function captureScreenshot(options: ScreenshotOptions = {}): Promise<ScreenshotResult> {
  const {
    quality = 0.8,
    format = 'jpeg',
    excludeElements = [],
    scale = 1,
    width,
    height,
    element
  } = options;

  // Store original styles of elements to hide
  const elementsToHide: Array<{ element: HTMLElement; originalStyle: string }> = [];

  try {
    // Hide specified elements
    excludeElements.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        const htmlEl = el as HTMLElement;
        elementsToHide.push({
          element: htmlEl,
          originalStyle: htmlEl.style.display
        });
        htmlEl.style.display = 'none';
      });
    });

    // Capture screenshot of the specified element or the entire body
    const targetElement = element || document.body;
    const canvas = await html2canvas(targetElement, {
      useCORS: true,
      allowTaint: false,
      scale,
      width,
      height,
      backgroundColor: '#ffffff',
      logging: false,
      ignoreElements: (element) => {
        // Additional element filtering if needed
        return element.classList.contains('screenshot-exclude');
      }
    });

    // Convert to desired format
    const dataUrl = canvas.toDataURL(`image/${format}`, quality);

    // Convert to blob for easier handling
    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob!);
      }, `image/${format}`, quality);
    });

    return {
      dataUrl,
      blob,
      metadata: {
        timestamp: Date.now(),
        url: window.location.href,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        },
        userAgent: navigator.userAgent
      }
    };
  } finally {
    // Restore original styles
    elementsToHide.forEach(({ element, originalStyle }) => {
      element.style.display = originalStyle;
    });
  }
}

/**
 * Captures a screenshot specifically for debug purposes
 * Automatically excludes debug panels and overlays
 */
export async function captureDebugScreenshot(): Promise<ScreenshotResult> {
  return captureScreenshot({
    quality: 0.8,
    format: 'jpeg',
    excludeElements: [
      '[data-debug-panel]',
      '[data-overlay]',
      '.debug-panel',
      '.modal-overlay',
      '.toast-container',
      '[data-radix-portal]', // Exclude Radix UI portals
      '[role="dialog"]' // Exclude modals
    ],
    scale: 1
  });
}
