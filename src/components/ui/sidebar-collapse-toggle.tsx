/**
 * Sidebar Collapse Toggle
 *
 * A standardized edge-mounted collapse/expand trigger for sidebars.
 * Positioned on the right edge of the sidebar, vertically centered.
 * Uses chevron icons in a circular button that overlaps the gap between
 * the sidebar and main content area.
 *
 * ## Design Specification
 *
 * - **Position**: Absolute, right edge (-12px to overlap gap), vertically centered (top-1/2)
 * - **Size**: 24x24px circle
 * - **Icon**: Chevron left (‹) when expanded, Chevron right (›) when collapsed
 * - **Styling**:
 *   - Background: bg-card (matches sidebar)
 *   - Border: 1px border-border
 *   - Shadow: subtle shadow-sm
 *   - Hover: bg-cb-hover
 * - **Z-index**: 10 (above sidebar content, below modals)
 *
 * ## Usage
 *
 * ```tsx
 * <div className="relative"> // Sidebar wrapper must have relative positioning
 *   <SidebarCollapseToggle
 *     isCollapsed={sidebarState === 'collapsed'}
 *     onToggle={toggleSidebar}
 *   />
 *   <FolderSidebar ... />
 * </div>
 * ```
 *
 * @pattern sidebar-collapse-toggle
 * @brand-version v4.1
 */

import * as React from 'react';
import { RiArrowLeftSLine, RiArrowRightSLine } from '@remixicon/react';
import { cn } from '@/lib/utils';

interface SidebarCollapseToggleProps {
  /** Whether the sidebar is currently collapsed */
  isCollapsed: boolean;
  /** Callback when toggle is clicked */
  onToggle: () => void;
  /** Additional CSS classes */
  className?: string;
  /** Accessible label for the button */
  label?: string;
}

export function SidebarCollapseToggle({
  isCollapsed,
  onToggle,
  className,
  label,
}: SidebarCollapseToggleProps) {
  const defaultLabel = isCollapsed ? 'Expand sidebar' : 'Collapse sidebar';

  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        // Position: absolute on right edge, vertically centered
        'absolute -right-3 top-1/2 -translate-y-1/2 z-10',
        // Size: 24x24 circle
        'w-6 h-6 rounded-full',
        // Flex centering for icon
        'flex items-center justify-center',
        // Colors: match card bg with border
        'bg-card border border-border shadow-sm',
        // Hover state
        'hover:bg-cb-hover transition-colors duration-150',
        // Focus state (accessibility)
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-cb-vibe-orange focus-visible:ring-offset-2',
        // Cursor
        'cursor-pointer',
        className
      )}
      aria-label={label || defaultLabel}
      title={label || defaultLabel}
    >
      {isCollapsed ? (
        <RiArrowRightSLine className="w-4 h-4 text-cb-ink-muted" />
      ) : (
        <RiArrowLeftSLine className="w-4 h-4 text-cb-ink-muted" />
      )}
    </button>
  );
}

/**
 * Standard sidebar wrapper that includes the collapse toggle.
 * Use this for consistent sidebar implementations across the app.
 *
 * ## Usage
 *
 * ```tsx
 * <SidebarWrapper
 *   isCollapsed={sidebarState === 'collapsed'}
 *   onToggle={toggleSidebar}
 *   expandedWidth="280px"
 *   collapsedWidth="44px"
 * >
 *   <FolderSidebar ... />
 * </SidebarWrapper>
 * ```
 */
interface SidebarWrapperProps {
  children: React.ReactNode;
  /** Whether the sidebar is currently collapsed */
  isCollapsed: boolean;
  /** Callback when toggle is clicked */
  onToggle: () => void;
  /** Width when expanded (default: 280px) */
  expandedWidth?: string;
  /** Width when collapsed (default: 44px) */
  collapsedWidth?: string;
  /** Additional CSS classes for the wrapper */
  className?: string;
  /** Whether to show on mobile (default: false - uses overlay pattern) */
  showOnMobile?: boolean;
}

export function SidebarWrapper({
  children,
  isCollapsed,
  onToggle,
  expandedWidth = '280px',
  collapsedWidth = '56px',  // Updated to fit nav icons
  className,
}: SidebarWrapperProps) {
  return (
    <div
      className={cn(
        'relative flex-shrink-0 transition-all duration-200 h-full',
        // Background: match card styling for consistency
        'bg-card rounded-2xl border border-border',
        className
      )}
      style={{
        width: isCollapsed ? collapsedWidth : expandedWidth,
      }}
    >
      {/* Edge-mounted collapse toggle - hidden on mobile, shown on desktop */}
      <div className="hidden md:block">
        <SidebarCollapseToggle
          isCollapsed={isCollapsed}
          onToggle={onToggle}
        />
      </div>

      {/* Sidebar content */}
      {children}
    </div>
  );
}
