/**
 * PaneContainer - Reusable pane wrapper with consistent styling
 *
 * Provides consistent visual treatment for all pane types in the multi-pane layout.
 * Follows brand guidelines for border-radius, shadows, transitions.
 *
 * ## Design Specification
 * - **Styling**: Rounded corners (2xl), subtle border, shadow
 * - **Transitions**: 500ms ease-in-out for premium feel
 * - **Variants**:
 *   - primary: flex-1 main content (Pane 3)
 *   - secondary: w-[280px] context panel (Pane 2)
 *   - detail: w-[360px] desktop, w-[320px] tablet (Pane 4+)
 *
 * @pattern pane-container
 * @brand-version v4.1
 */

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface PaneContainerProps {
  /** Content to render inside the pane */
  children: React.ReactNode;
  /** Pane variant - determines width and behavior */
  variant?: 'primary' | 'secondary' | 'detail';
  /** Whether the pane is currently visible */
  isVisible?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** ARIA role for accessibility */
  role?: string;
  /** ARIA label for accessibility */
  ariaLabel?: string;
  /** Tab index for keyboard navigation */
  tabIndex?: number;
}

/**
 * Reusable pane container with consistent styling
 *
 * Provides the standard pane visual treatment:
 * - Rounded corners (rounded-2xl)
 * - Subtle border (border-border/60)
 * - Soft shadow
 * - Smooth transitions (500ms)
 *
 * @example
 * ```tsx
 * <PaneContainer variant="secondary" isVisible={isLibraryOpen}>
 *   <FolderSidebar />
 * </PaneContainer>
 * ```
 */
export function PaneContainer({
  children,
  variant = 'primary',
  isVisible = true,
  className,
  role,
  ariaLabel,
  tabIndex
}: PaneContainerProps) {
  // Base styles - consistent across all pane types
  const baseStyles = cn(
    // Visual styling
    "bg-card rounded-2xl border border-border/60 shadow-sm",
    // Layout
    "flex flex-col h-full overflow-hidden",
    // Z-index
    "z-10",
    // Transitions - 500ms for premium feel
    "transition-all duration-500 ease-in-out"
  );

  // Variant-specific styles
  const variantStyles = {
    // Primary: Main content pane (flex-1, always visible)
    primary: cn(
      "flex-1 min-w-0",
      "relative" // For absolute positioned children
    ),

    // Secondary: Context panel (280px, collapsible)
    secondary: cn(
      "flex-shrink-0",
      "bg-card/80 backdrop-blur-md", // Semi-transparent with blur
      isVisible
        ? "w-[280px] opacity-100 ml-0"
        : "w-0 opacity-0 -ml-3 border-0"
    ),

    // Detail: Right panel (360px desktop, 320px tablet, collapsible)
    detail: cn(
      "flex-shrink-0",
      isVisible
        ? "opacity-100 translate-x-0"
        : "w-0 opacity-0 translate-x-4 border-0"
    )
  };

  return (
    <div
      className={cn(
        baseStyles,
        variantStyles[variant],
        className
      )}
      role={role}
      aria-label={ariaLabel}
      aria-hidden={variant !== 'primary' && !isVisible}
      tabIndex={tabIndex}
    >
      {children}
    </div>
  );
}
