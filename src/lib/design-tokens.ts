/**
 * Conversion Brain Design System Tokens
 * 
 * Centralized design constants that enforce brand guidelines.
 * These tokens should be used throughout the application for consistency.
 */

/**
 * Typography Scale
 * Montserrat 800 for headers (ALL CAPS), Inter for body
 */
export const typography = {
  // Headers (Montserrat 800 ALL CAPS)
  display: {
    fontFamily: "Montserrat, system-ui, sans-serif",
    fontWeight: 800,
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
  },
  
  // Body text (Inter)
  body: {
    fontFamily: "Inter, system-ui, sans-serif",
    fontWeight: {
      regular: 400,
      medium: 500,
      semibold: 600,
    },
  },
  
  // Sizes
  sizes: {
    xs: "0.625rem",    // 10px
    sm: "0.75rem",     // 12px
    base: "0.875rem",  // 14px
    lg: "1rem",        // 16px
    xl: "1.25rem",     // 20px
    "2xl": "1.5rem",   // 24px
    "3xl": "2rem",     // 32px
  },
} as const;

/**
 * Spacing Scale
 * Consistent spacing throughout the app
 */
export const spacing = {
  xs: "0.25rem",   // 4px
  sm: "0.5rem",    // 8px
  md: "1rem",      // 16px
  lg: "1.5rem",    // 24px
  xl: "2rem",      // 32px
  "2xl": "3rem",   // 48px
  "3xl": "4rem",   // 64px
} as const;

/**
 * Border Radius
 */
export const borderRadius = {
  sm: "0.25rem",   // 4px
  md: "0.5rem",    // 8px
  lg: "0.75rem",   // 12px
  xl: "1rem",      // 16px
  full: "9999px",  // Pill shape
} as const;

/**
 * Vibe Green Usage Rules
 * 
 * CRITICAL: Vibe Green (#D9FC67) is ONLY allowed in these 5 contexts:
 */
export const vibeGreenApprovedContexts = [
  "active-route-indicator",      // 1. Active navigation item indicator
  "active-tab-underline",         // 2. Active tab underline/indicator
  "primary-cta-gradient",         // 3. Primary CTA button gradient
  "success-status-accent",        // 4. Success status pill accent
  "focus-ring",                   // 5. Focus ring on interactive elements
] as const;

export type VibeGreenContext = typeof vibeGreenApprovedContexts[number];

/**
 * Status Colors
 * Semantic colors for different states
 */
export const statusColors = {
  success: {
    bg: "hsl(var(--cb-success-bg))",
    text: "hsl(var(--cb-success-text))",
    border: "hsl(var(--cb-success-border))",
  },
  warning: {
    bg: "hsl(var(--cb-warning-bg))",
    text: "hsl(var(--cb-warning-text))",
    border: "hsl(var(--cb-warning-border))",
  },
  danger: {
    bg: "hsl(var(--cb-danger-bg))",
    text: "hsl(var(--cb-danger-text))",
    border: "hsl(var(--cb-danger-border))",
  },
  info: {
    bg: "hsl(var(--cb-info-bg))",
    text: "hsl(var(--cb-info-text))",
    border: "hsl(var(--cb-info-border))",
  },
  neutral: {
    bg: "hsl(var(--cb-neutral-bg))",
    text: "hsl(var(--cb-neutral-text))",
    border: "hsl(var(--cb-neutral-border))",
  },
} as const;

/**
 * Monochromatic Palette
 */
export const monochromaticPalette = {
  white: "hsl(var(--cb-white))",
  ink: "hsl(var(--cb-ink))",
  inkSoft: "hsl(var(--cb-ink-soft))",
  inkMuted: "hsl(var(--cb-ink-muted))",
  border: "hsl(var(--cb-border))",
  borderSoft: "hsl(var(--cb-border-soft))",
  hover: "hsl(var(--cb-hover))",
} as const;

/**
 * Animation Durations
 */
export const duration = {
  fast: "150ms",
  base: "200ms",
  slow: "300ms",
  slower: "500ms",
} as const;

/**
 * Z-Index Scale
 */
export const zIndex = {
  base: 0,
  dropdown: 1000,
  sticky: 1100,
  fixed: 1200,
  modalBackdrop: 1300,
  modal: 1400,
  popover: 1500,
  tooltip: 1600,
} as const;

/**
 * Breakpoints
 */
export const breakpoints = {
  sm: "640px",
  md: "768px",
  lg: "1024px",
  xl: "1280px",
  "2xl": "1536px",
} as const;

/**
 * Pane System
 * Tri-state chat/pane system specifications
 */
export const PANE_SYSTEM = {
  gutterSize: "24px",
  cardBorderRadius: "16px",
  contentPadding: "48px",
  splitPaneWidth: "380px",
  animationDuration: "350ms",
  animationEasing: "cubic-bezier(0.4, 0, 0.2, 1)",
  zIndex: {
    base: 1,
    leftPane: 10,
    rightPane: 20,
    floatingWindow: 9999,
  },
  backgroundColor: {
    light: "#FAFAFA",
    dark: "#161616",
  },
  cardBackground: {
    light: "#FFFFFF",
    dark: "#202020",
  },
} as const;
