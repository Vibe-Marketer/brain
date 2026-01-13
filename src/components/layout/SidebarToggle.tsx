/**
 * SidebarToggle - Edge-mounted circular toggle button
 *
 * Floating toggle button that sits on the right edge of the sidebar.
 * Follows Loop-inspired design with smooth 500ms animation.
 *
 * ## Design Specification
 * - **Position**: Absolute, vertically centered, -12px from right edge (half outside)
 * - **Size**: 24x24px circular button
 * - **Animation**: Chevron rotates 180deg in 500ms
 * - **Z-index**: z-20 (above overlay at z-0 and content at z-10)
 * - **Critical**: Uses stopPropagation() to prevent double-toggle with overlay
 *
 * @pattern sidebar-toggle
 * @brand-version v4.1
 */

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SidebarToggleProps {
  /** Whether the sidebar is currently expanded */
  isExpanded: boolean;
  /** Callback when toggle is clicked */
  onToggle: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Edge-mounted sidebar toggle button
 *
 * CRITICAL: Must use stopPropagation() to prevent triggering
 * the click-to-toggle overlay behind it.
 *
 * @example
 * ```tsx
 * <SidebarToggle
 *   isExpanded={isSidebarExpanded}
 *   onToggle={() => setIsSidebarExpanded(!isSidebarExpanded)}
 * />
 * ```
 */
export function SidebarToggle({
  isExpanded,
  onToggle,
  className
}: SidebarToggleProps) {
  return (
    <button
      onClick={(e) => {
        // CRITICAL: Prevents triggering the overlay click handler
        e.stopPropagation();
        onToggle();
      }}
      className={cn(
        // Position: Half outside the sidebar, vertically centered
        "absolute top-1/2 -translate-y-1/2 -right-3",
        // Z-index: Above overlay (z-0) and content (z-10)
        "z-20",
        // Size: 24x24px circular button
        "w-6 h-6 rounded-full",
        // Styling: Card background with border and shadow
        "bg-card border border-border shadow-sm",
        // Layout: Center the chevron icon
        "flex items-center justify-center",
        // Interaction: Subtle hover state
        "hover:bg-muted transition-colors",
        className
      )}
      aria-label={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
      aria-expanded={isExpanded}
      type="button"
    >
      {/* Chevron icon - rotates 180deg when collapsed */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn(
          // CRITICAL: 500ms for premium feel (NOT 300ms)
          "transition-transform duration-500",
          // Rotation: Points left when expanded, right when collapsed
          isExpanded ? "rotate-0" : "rotate-180"
        )}
        aria-hidden="true"
      >
        {/* Chevron pointing left */}
        <polyline points="15 18 9 12 15 6" />
      </svg>
    </button>
  );
}
