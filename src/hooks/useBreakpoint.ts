import * as React from "react";

/**
 * Breakpoint thresholds for responsive layout behavior
 * - mobile: < 768px (phone)
 * - tablet: 768px - 1023px (tablet)
 * - desktop: >= 1024px (desktop)
 */
export const BREAKPOINTS = {
  mobile: 768,
  tablet: 1024,
} as const;

export type Breakpoint = "mobile" | "tablet" | "desktop";

/**
 * Hook to detect the current responsive breakpoint
 * Returns 'mobile' | 'tablet' | 'desktop' based on window width
 *
 * Uses matchMedia for efficient event-based updates rather than
 * continuous resize monitoring.
 */
export function useBreakpoint(): Breakpoint {
  const [breakpoint, setBreakpoint] = React.useState<Breakpoint>(() => {
    // SSR-safe initial value
    if (typeof window === "undefined") return "desktop";
    return getBreakpoint(window.innerWidth);
  });

  React.useEffect(() => {
    const mobileQuery = window.matchMedia(`(max-width: ${BREAKPOINTS.mobile - 1}px)`);
    const tabletQuery = window.matchMedia(`(min-width: ${BREAKPOINTS.mobile}px) and (max-width: ${BREAKPOINTS.tablet - 1}px)`);

    const updateBreakpoint = () => {
      setBreakpoint(getBreakpoint(window.innerWidth));
    };

    // Initial check
    updateBreakpoint();

    // Listen for changes
    mobileQuery.addEventListener("change", updateBreakpoint);
    tabletQuery.addEventListener("change", updateBreakpoint);

    return () => {
      mobileQuery.removeEventListener("change", updateBreakpoint);
      tabletQuery.removeEventListener("change", updateBreakpoint);
    };
  }, []);

  return breakpoint;
}

function getBreakpoint(width: number): Breakpoint {
  if (width < BREAKPOINTS.mobile) return "mobile";
  if (width < BREAKPOINTS.tablet) return "tablet";
  return "desktop";
}

/**
 * Hook that returns boolean flags for each breakpoint
 * Useful for conditional rendering based on screen size
 */
export function useBreakpointFlags() {
  const breakpoint = useBreakpoint();

  return React.useMemo(() => ({
    isMobile: breakpoint === "mobile",
    isTablet: breakpoint === "tablet",
    isDesktop: breakpoint === "desktop",
    isMobileOrTablet: breakpoint === "mobile" || breakpoint === "tablet",
    isTabletOrDesktop: breakpoint === "tablet" || breakpoint === "desktop",
  }), [breakpoint]);
}
