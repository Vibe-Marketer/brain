/**
 * Sidebar Navigation
 *
 * Navigation icons that sit at the top of the sidebar.
 * Loop-inspired design with clean, modern aesthetics.
 * Uses Remix Icons with line/fill variants for active states.
 *
 * ## Design Specification
 *
 * - **Position**: Top of sidebar, above folder list
 * - **Layout**: Vertical column with icons and labels
 * - **Size**: 44x44px icon buttons (collapsed) or full-width items (expanded)
 * - **Styling**:
 *   - Clean, modern appearance
 *   - Glossy 3D icons in collapsed mode
 *   - Active state: left border indicator (vibe orange) + fill icon
 *   - Inactive state: line icon
 *   - Hover: subtle background highlight
 * - **Separator**: Thin gray line between sections
 *
 * @pattern sidebar-nav
 * @brand-version v4.1
 */

import * as React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  RiLayoutColumnLine,
  RiAddLine,
  RiHome4Line,
  RiHome4Fill,
  RiSparklingLine,
  RiSparklingFill,
  RiPriceTag3Line,
  RiPriceTag3Fill,
  RiSettings3Line,
  RiSettings3Fill,
} from '@remixicon/react';
import type { RemixiconComponentType } from '@remixicon/react';
import { cn } from '@/lib/utils';

interface NavItem {
  id: string;
  name: string;
  /** Line icon variant (used when inactive) */
  iconLine: RemixiconComponentType;
  /** Fill icon variant (used when active) */
  iconFill: RemixiconComponentType;
  path: string;
  matchPaths?: string[];
}

interface SidebarNavProps {
  /** Whether the sidebar is collapsed */
  isCollapsed?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Optional callback for the Sync/Plus button */
  onSyncClick?: () => void;
  /** Optional callback to toggle the Library panel */
  onLibraryToggle?: () => void;
  /** Optional callback when Settings nav item is clicked (to open category pane) */
  onSettingsClick?: () => void;
  /** Optional callback when Sorting nav item is clicked (to open category pane) */
  onSortingClick?: () => void;
}

/**
 * Glossy 3D icon wrapper with dark mode support.
 * Light mode: White to light gray gradient
 * Dark mode: Dark gray gradient with adjusted shadows
 */
const NavIcon = React.memo(({ children, isActive }: { children: React.ReactNode; isActive?: boolean }) => (
  <div
    className={cn(
      'w-full h-full flex items-center justify-center rounded-xl transition-all duration-150',
      // Light mode styles
      'bg-gradient-to-br from-white to-gray-200',
      'border border-gray-300/80',
      'shadow-[inset_0_4px_6px_rgba(255,255,255,0.5),inset_0_-4px_6px_rgba(0,0,0,0.08),0_10px_20px_rgba(0,0,0,0.08)]',
      // Dark mode styles
      'dark:from-gray-700 dark:to-gray-800',
      'dark:border-gray-600/80',
      'dark:shadow-[inset_0_4px_6px_rgba(255,255,255,0.1),inset_0_-4px_6px_rgba(0,0,0,0.2),0_10px_20px_rgba(0,0,0,0.3)]',
      // Active state
      isActive && 'ring-2 ring-cb-vibe-orange/50'
    )}
  >
    {children}
  </div>
));

// Icon class for consistent styling - muted gray for inactive state
const iconClass = 'w-5 h-5 text-muted-foreground';

const navItems: NavItem[] = [
  {
    id: 'home',
    name: 'Home',
    iconLine: RiHome4Line,
    iconFill: RiHome4Fill,
    path: '/',
    matchPaths: ['/', '/transcripts'],
  },
  {
    id: 'chat',
    name: 'AI Chat',
    iconLine: RiSparklingLine,
    iconFill: RiSparklingFill,
    path: '/chat',
    matchPaths: ['/chat'],
  },
  {
    id: 'sorting',
    name: 'Sorting',
    iconLine: RiPriceTag3Line,
    iconFill: RiPriceTag3Fill,
    path: '/sorting-tagging',
    matchPaths: ['/sorting-tagging'],
  },
  {
    id: 'settings',
    name: 'Settings',
    iconLine: RiSettings3Line,
    iconFill: RiSettings3Fill,
    path: '/settings',
    matchPaths: ['/settings'],
  },
];

export function SidebarNav({ isCollapsed, className, onSyncClick, onLibraryToggle, onSettingsClick, onSortingClick }: SidebarNavProps) {
  const navigate = useNavigate();
  const location = useLocation();

  // Memoized active state checker to avoid recreating on every render
  const isActive = React.useCallback((item: NavItem) => {
    if (item.matchPaths) {
      return item.matchPaths.some(path =>
        path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)
      );
    }
    return location.pathname === item.path;
  }, [location.pathname]);

  return (
    <div className={cn('flex-shrink-0', className)}>
      {/* Navigation icons */}
      <div
        className={cn(
          'flex gap-2 p-3',
          isCollapsed ? 'flex-col items-center' : 'flex-col items-stretch px-4'
        )}
      >
        {/* Main Nav Items */}
        {navItems.map((item) => {
          const active = isActive(item);
          return (
            <div key={item.id} className="relative flex flex-col mb-1">
              {/* Active indicator - left border (Loop-style) with smooth transition - visible in expanded mode */}
              {!isCollapsed && (
                <div
                  className={cn(
                    "absolute left-0 top-1/2 -translate-y-1/2 w-1 h-[80%] bg-cb-vibe-orange rounded-r-full",
                    "transition-all duration-200 ease-in-out",
                    active
                      ? "opacity-100 scale-y-100"
                      : "opacity-0 scale-y-0"
                  )}
                  aria-hidden="true"
                />
              )}
              <button
                type="button"
                onClick={() => {
                  navigate(item.path);
                  // Call settings callback when Settings nav item is clicked
                  if (item.id === 'settings' && onSettingsClick) {
                    onSettingsClick();
                  }
                  // Call sorting callback when Sorting nav item is clicked
                  if (item.id === 'sorting' && onSortingClick) {
                    onSortingClick();
                  }
                }}
                className={cn(
                  'relative flex items-center',
                  isCollapsed ? 'justify-center w-11 h-11' : 'justify-start w-full px-3 h-10 gap-3',
                  'rounded-xl transition-all duration-500 ease-in-out',
                  'hover:bg-gray-100 dark:hover:bg-white/10',
                  active && !isCollapsed && 'bg-cb-vibe-orange/10 dark:bg-cb-vibe-orange/20 text-cb-vibe-orange',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-cb-vibe-orange focus-visible:ring-offset-2'
                )}
                title={item.name}
              >
                  {/* Icon Container */}
                  <div className={cn(
                      "flex-shrink-0 flex items-center justify-center",
                       isCollapsed ? "w-11 h-11" : "w-5 h-5"
                  )}>
                     {(() => {
                       const IconComponent = active ? item.iconFill : item.iconLine;
                       const icon = <IconComponent className={cn(iconClass, active && "text-cb-vibe-orange")} />;
                       return isCollapsed ? <NavIcon isActive={active}>{icon}</NavIcon> : icon;
                     })()}
                  </div>

                  {/* Label - Visible only when expanded */}
                  {!isCollapsed && (
                      <span className={cn(
                        "text-sm truncate transition-colors",
                        active ? "font-semibold text-cb-vibe-orange" : "text-foreground"
                      )}>{item.name}</span>
                  )}
              </button>

               {/* Active indicator dot (Only in collapsed mode) */}
              {active && isCollapsed && (
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-cb-vibe-orange" />
              )}
            </div>
          );
        })}

        {/* Separator - Visible in expanded mode */}
        {!isCollapsed && <div className="h-px bg-border my-2 mx-3" />}

        {/* Library Toggle Action - As a list item in expanded mode */}
        {onLibraryToggle && (
           <div className="relative flex flex-col mt-1">
            <button
              type="button"
              onClick={onLibraryToggle}
              className={cn(
                'relative flex items-center',
                isCollapsed ? 'justify-center w-11 h-11' : 'justify-start w-full px-3 h-10 gap-3',
                'rounded-xl transition-all duration-500 ease-in-out',
                'hover:bg-gray-100 dark:hover:bg-white/10',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-cb-vibe-orange focus-visible:ring-offset-2'
              )}
              title="Toggle Library Panel"
            >
               <div className={cn(
                      "flex-shrink-0 flex items-center justify-center",
                       isCollapsed ? "w-11 h-11" : "w-5 h-5 text-muted-foreground"
                  )}>
                  {isCollapsed ? (
                      <NavIcon>
                        <RiLayoutColumnLine className={iconClass} />
                      </NavIcon>
                  ) : (
                    <RiLayoutColumnLine className="w-5 h-5" />
                  )}
              </div>
              {!isCollapsed && <span className="text-sm text-muted-foreground truncate">Library Panel</span>}
            </button>
             {isCollapsed && <div className="w-8 h-px bg-cb-border mt-2 mx-auto" />}
          </div>
        )}

        {/* Optional Sync/Add Action */}
        {onSyncClick && (
          <div className="relative flex flex-col mt-1">
             <button
              type="button"
              onClick={onSyncClick}
              className={cn(
                'relative flex items-center',
                isCollapsed ? 'justify-center w-11 h-11' : 'justify-start w-full px-3 h-10 gap-3',
                'rounded-xl transition-all duration-500 ease-in-out',
                'hover:bg-gray-100 dark:hover:bg-white/10',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-cb-vibe-orange focus-visible:ring-offset-2'
              )}
              title="Sync & Import"
            >
               <div className={cn(
                      "flex-shrink-0 flex items-center justify-center",
                       isCollapsed ? "w-11 h-11" : "w-5 h-5 text-cb-vibe-orange"
                  )}>
                   {isCollapsed ? (
                       <NavIcon>
                        <RiAddLine className={iconClass} />
                      </NavIcon>
                   ) : (
                    <RiAddLine className="w-5 h-5" />
                   )}
              </div>
              {!isCollapsed && <span className="text-sm font-medium text-cb-vibe-orange truncate">Sync & Import</span>}
            </button>
          </div>
        )}
      </div>

      {/* Separator line */}
      <div className="mx-3 border-t border-cb-border" />
    </div>
  );
}
