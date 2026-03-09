/**
 * Sidebar Navigation
 *
 * Navigation icons that sit at the top of the sidebar.
 * Clean, modern aesthetics — same icon style in both expanded and collapsed modes.
 * Uses Remix Icons with line/fill variants for active states.
 *
 * ## Design Specification
 *
 * - **Position**: Top of sidebar, above folder list
 * - **Layout**: Vertical column with icons and labels
 * - **Size**: Consistent icon size in both modes, centered when collapsed
 * - **Styling**:
 *   - Clean, cohesive appearance in both modes
 *   - Active state: left border indicator (vibe orange) + fill icon
 *   - Inactive state: line icon
 *   - Hover: subtle background highlight
 * - **Separator**: Thin gray line between sections
 *
 * @pattern sidebar-nav
 * @brand-version v4.2
 */

import * as React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  RiLayoutColumnLine,
  RiAddLine,
  RiHome4Line,
  RiSettings3Line,
  RiUpload2Line,
} from '@remixicon/react';
import type { RemixiconComponentType } from '@remixicon/react';
import { cn } from '@/lib/utils';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { useUserRole } from '@/hooks/useUserRole';

interface NavItem {
  id: string;
  name: string;
  /** Line icon variant */
  iconLine: RemixiconComponentType;
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
  /** Optional callback when Analytics nav item is clicked (to open category pane) */
  onAnalyticsClick?: () => void;
}

// Icon class for consistent styling - muted gray for inactive state
const iconClass = 'w-5 h-5 text-muted-foreground';

const navItems: NavItem[] = [
  {
    id: 'home',
    name: 'Home',
    iconLine: RiHome4Line,
    path: '/',
    matchPaths: ['/', '/transcripts'],
  },
  {
    id: 'import',
    name: 'Import',
    iconLine: RiUpload2Line,
    path: '/import',
    matchPaths: ['/import'],
  },
  {
    id: 'settings',
    name: 'Settings',
    iconLine: RiSettings3Line,
    path: '/settings',
    matchPaths: ['/settings'],
  },
];

export function SidebarNav({ isCollapsed, className, onSyncClick, onLibraryToggle, onSettingsClick, onSortingClick, onAnalyticsClick }: SidebarNavProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { role } = useUserRole();
  const { isFeatureEnabled } = useFeatureFlags(role);

  // Filter nav items based on feature flags
  const filteredNavItems = React.useMemo(() => {
    return navItems.filter((item) => {
      if (item.id === 'import') return isFeatureEnabled('beta_imports');
      if (item.id === 'analytics') return isFeatureEnabled('beta_analytics');
      return true;
    });
  }, [navItems, isFeatureEnabled]);

  // Refs for nav buttons to enable keyboard focus management
  const buttonRefs = React.useRef<Map<string, HTMLButtonElement>>(new Map());

  // Memoized active state checker to avoid recreating on every render
  const isActive = React.useCallback((item: NavItem) => {
    if (item.matchPaths) {
      return item.matchPaths.some(path =>
        path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)
      );
    }
    return location.pathname === item.path;
  }, [location.pathname]);

  // Focus a nav item by index (wraps around)
  const focusNavItemByIndex = React.useCallback((index: number) => {
    const wrappedIndex = ((index % filteredNavItems.length) + filteredNavItems.length) % filteredNavItems.length;
    const itemId = filteredNavItems[wrappedIndex].id;
    const button = buttonRefs.current.get(itemId);
    button?.focus();
  }, [filteredNavItems]);

  // Keyboard navigation handler
  const handleKeyDown = React.useCallback((event: React.KeyboardEvent, itemId: string) => {
    const currentIndex = filteredNavItems.findIndex(item => item.id === itemId);

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        focusNavItemByIndex(currentIndex + 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        focusNavItemByIndex(currentIndex - 1);
        break;
      case 'Home':
        event.preventDefault();
        focusNavItemByIndex(0);
        break;
      case 'End':
        event.preventDefault();
        focusNavItemByIndex(filteredNavItems.length - 1);
        break;
    }
  }, [focusNavItemByIndex]);

  return (
    <div className={cn('flex-shrink-0', className)}>
      {/* Navigation icons */}
      <nav
        className={cn(
          'flex gap-2 p-3',
          isCollapsed ? 'flex-col items-center' : 'flex-col items-stretch px-4'
        )}
        role="navigation"
        aria-label="Main navigation"
      >
        {/* Import Button - Primary CTA at top */}
        {onSyncClick && isFeatureEnabled('beta_imports') && (
          <div className="relative flex flex-col">
             <button
              type="button"
              onClick={onSyncClick}
              className={cn(
                'relative flex items-center',
                isCollapsed ? 'justify-center w-11 h-11' : 'justify-start w-full px-3 h-10 gap-3',
                'rounded-xl transition-all duration-500 ease-in-out',
                'hover:opacity-90 hover:scale-[1.02]',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-vibe-orange focus-visible:ring-offset-2'
              )}
              title="Sync & Import"
            >
               {/* Collapsed mode: Gradient icon container */}
               {isCollapsed ? (
                 <div
                   className="flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-xl shadow-lg"
                   style={{
                     background: 'linear-gradient(135deg, #FFEB00 0%, #FF8800 50%, #FF3D00 100%)',
                   }}
                 >
                   <RiAddLine className="w-5 h-5 text-white" />
                 </div>
               ) : (
                 /* Expanded mode: Gradient container with icon and text */
                 <div
                   className="flex items-center gap-2 px-3 py-2 rounded-xl shadow-lg w-full"
                   style={{
                     background: 'linear-gradient(135deg, #FFEB00 0%, #FF8800 50%, #FF3D00 100%)',
                   }}
                 >
                   <RiAddLine className="w-5 h-5 text-white flex-shrink-0" />
                   <span className="text-sm font-semibold text-white uppercase tracking-wide">Import</span>
                 </div>
               )}
            </button>
          </div>
        )}

        {/* Separator between Import and nav items */}
        {onSyncClick && isFeatureEnabled('beta_imports') && (
          isCollapsed ? (
            <div className="w-8 h-px bg-border my-1 mx-auto" />
          ) : (
            <div className="h-px bg-border my-2 mx-3" />
          )
        )}

        {/* Main Nav Items */}
        {filteredNavItems.map((item) => {
          const active = isActive(item);
          return (
            <div key={item.id} className="relative flex flex-col mb-1">
              <button
                ref={(el) => {
                  if (el) {
                    buttonRefs.current.set(item.id, el);
                  } else {
                    buttonRefs.current.delete(item.id);
                  }
                }}
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
                  // Call analytics callback when Analytics nav item is clicked
                  if (item.id === 'analytics' && onAnalyticsClick) {
                    onAnalyticsClick();
                  }
                }}
                onKeyDown={(e) => handleKeyDown(e, item.id)}
                className={cn(
                  'relative flex items-center',
                  isCollapsed ? 'justify-center w-10 h-10 px-0' : 'justify-start w-full px-3 h-10 gap-3',
                  'rounded-lg border border-transparent transition-all duration-500 ease-in-out',
                  'hover:bg-hover/70',
                  isCollapsed && active && 'bg-vibe-orange/10',
                  active && !isCollapsed && [
                    'bg-hover border-border pl-4',
                    "before:content-[''] before:absolute before:left-1 before:top-1/2 before:-translate-y-1/2 before:w-1 before:h-[65%] before:rounded-full before:bg-vibe-orange"
                  ],
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-vibe-orange focus-visible:ring-offset-2'
                )}
                title={item.name}
              >
                  {/* Icon — same clean rendering in both modes */}
                  <div className={cn(
                      "flex-shrink-0 flex items-center justify-center",
                       isCollapsed ? "w-10 h-10" : "w-5 h-5"
                  )}>
                     {(() => {
                        const IconComponent = item.iconLine;
                        return <IconComponent className={cn(iconClass, active && "text-vibe-orange")} />;
                     })()}
                  </div>

                  {/* Label - Visible only when expanded */}
                  {!isCollapsed && (
                      <span className={cn(
                        "text-sm truncate transition-colors",
                        active ? "font-medium text-foreground" : "text-foreground"
                      )}>{item.name}</span>
                  )}
              </button>
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
                'hover:bg-hover',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-vibe-orange focus-visible:ring-offset-2'
              )}
              title="Toggle Workspace Panel"
            >
               <div className={cn(
                      "flex-shrink-0 flex items-center justify-center",
                       isCollapsed ? "w-10 h-10" : "w-5 h-5 text-muted-foreground"
                  )}>
                  <RiLayoutColumnLine className={iconClass} />
              </div>
              {!isCollapsed && <span className="text-sm text-muted-foreground truncate">Workspace Panel</span>}
            </button>
             {isCollapsed && <div className="w-8 h-px bg-cb-border mt-2 mx-auto" />}
          </div>
        )}

      </nav>

      {/* Separator line */}
      <div className="mx-3 border-t border-border" />
    </div>
  );
}
