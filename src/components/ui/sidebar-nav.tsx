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
  RiArticleLine,
  RiArticleFill,
  RiPriceTag3Line,
  RiPriceTag3Fill,
  RiTeamLine,
  RiTeamFill,
  RiSettings3Line,
  RiSettings3Fill,
  RiPieChart2Line,
  RiPieChart2Fill,
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
  /** Optional callback when Analytics nav item is clicked (to open category pane) */
  onAnalyticsClick?: () => void;
}

/**
 * NavIcon Props - supports both Remix Icon components and React nodes
 */
interface NavIconProps {
  /** Remix Icon component type for line variant (inactive state) */
  icon?: RemixiconComponentType;
  /** Remix Icon component type for fill variant (active state) */
  iconFill?: RemixiconComponentType;
  /** Whether the icon is in active state */
  isActive?: boolean;
  /** Optional children (for backward compatibility with pre-rendered icons) */
  children?: React.ReactNode;
}

/**
 * Glossy 3D icon wrapper with dark mode support.
 * Light mode: White to light gray gradient
 * Dark mode: Dark gray gradient with adjusted shadows
 *
 * Supports two usage patterns:
 * 1. Pass Remix Icon components directly via icon/iconFill props
 * 2. Pass pre-rendered React nodes as children (backward compatible)
 */
const NavIcon = React.memo(({ icon: IconLine, iconFill: IconFill, isActive, children }: NavIconProps) => {
  // Determine which icon to render based on props and active state
  const renderIcon = () => {
    // If icon components are provided, render the appropriate one
    if (IconLine || IconFill) {
      const IconComponent = isActive && IconFill ? IconFill : IconLine;
      if (IconComponent) {
        return (
          <IconComponent
            className={cn(
              iconClass,
              isActive && "text-vibe-orange"
            )}
          />
        );
      }
    }
    // Fall back to children for backward compatibility
    return children;
  };

  return (
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
        isActive && 'ring-2 ring-vibe-orange/50'
      )}
    >
      {renderIcon()}
    </div>
  );
});

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
    id: 'content',
    name: 'Content',
    iconLine: RiArticleLine,
    iconFill: RiArticleFill,
    path: '/content',
    matchPaths: ['/content', '/content/generators', '/content/library'],
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
    id: 'collaboration',
    name: 'Collaboration',
    iconLine: RiTeamLine,
    iconFill: RiTeamFill,
    path: '/team',
    matchPaths: ['/team', '/coaches'],
  },
  {
    id: 'settings',
    name: 'Settings',
    iconLine: RiSettings3Line,
    iconFill: RiSettings3Fill,
    path: '/settings',
    matchPaths: ['/settings'],
  },
  {
    id: 'analytics',
    name: 'Analytics',
    iconLine: RiPieChart2Line,
    iconFill: RiPieChart2Fill,
    path: '/analytics',
    matchPaths: ['/analytics'],
  },
];

export function SidebarNav({ isCollapsed, className, onSyncClick, onLibraryToggle, onSettingsClick, onSortingClick, onAnalyticsClick }: SidebarNavProps) {
  const navigate = useNavigate();
  const location = useLocation();

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
    const wrappedIndex = ((index % navItems.length) + navItems.length) % navItems.length;
    const itemId = navItems[wrappedIndex].id;
    const button = buttonRefs.current.get(itemId);
    button?.focus();
  }, []);

  // Keyboard navigation handler
  const handleKeyDown = React.useCallback((event: React.KeyboardEvent, itemId: string) => {
    const currentIndex = navItems.findIndex(item => item.id === itemId);

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
        focusNavItemByIndex(navItems.length - 1);
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
        {onSyncClick && (
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
        {onSyncClick && (
          isCollapsed ? (
            <div className="w-8 h-px bg-border my-1 mx-auto" />
          ) : (
            <div className="h-px bg-border my-2 mx-3" />
          )
        )}

        {/* Main Nav Items */}
        {navItems.map((item) => {
          const active = isActive(item);
          return (
            <div key={item.id} className="relative flex flex-col mb-1">
              {/* Active indicator - left-side orange pill with smooth scale-y transition - visible in both modes */}
              <div
                className={cn(
                  "absolute top-1/2 -translate-y-1/2 w-1 bg-vibe-orange rounded-full",
                  "transition-all duration-200 ease-in-out",
                  // Position and size based on mode
                  isCollapsed ? "left-0 h-[50%]" : "left-1 h-[60%]",
                  active
                    ? "opacity-100 scale-y-100"
                    : "opacity-0 scale-y-0"
                )}
                aria-hidden="true"
              />
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
                  isCollapsed ? 'justify-center w-11 h-11' : 'justify-start w-full px-3 h-10 gap-3',
                  'rounded-xl transition-all duration-500 ease-in-out',
                  'hover:bg-gray-100 dark:hover:bg-white/10',
                  active && !isCollapsed && 'bg-gray-100 dark:bg-gray-800',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-vibe-orange focus-visible:ring-offset-2'
                )}
                title={item.name}
              >
                  {/* Icon Container */}
                  <div className={cn(
                      "flex-shrink-0 flex items-center justify-center",
                       isCollapsed ? "w-11 h-11" : "w-5 h-5"
                  )}>
                     {isCollapsed ? (
                       // Collapsed mode: Use NavIcon with icon props for glossy 3D effect
                       <NavIcon
                         icon={item.iconLine}
                         iconFill={item.iconFill}
                         isActive={active}
                       />
                     ) : (
                       // Expanded mode: Render icon directly
                       (() => {
                         const IconComponent = active ? item.iconFill : item.iconLine;
                         return <IconComponent className={cn(iconClass, active && "text-vibe-orange")} />;
                       })()
                     )}
                  </div>

                  {/* Label - Visible only when expanded */}
                  {!isCollapsed && (
                      <span className={cn(
                        "text-sm truncate transition-colors",
                        active ? "font-semibold text-vibe-orange" : "text-foreground"
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
                'hover:bg-gray-100 dark:hover:bg-white/10',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-vibe-orange focus-visible:ring-offset-2'
              )}
              title="Toggle Library Panel"
            >
               <div className={cn(
                      "flex-shrink-0 flex items-center justify-center",
                       isCollapsed ? "w-11 h-11" : "w-5 h-5 text-muted-foreground"
                  )}>
                  {isCollapsed ? (
                      <NavIcon icon={RiLayoutColumnLine} />
                  ) : (
                    <RiLayoutColumnLine className="w-5 h-5" />
                  )}
              </div>
              {!isCollapsed && <span className="text-sm text-muted-foreground truncate">Library Panel</span>}
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
