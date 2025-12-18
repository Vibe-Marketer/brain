/**
 * Sidebar Navigation
 *
 * Navigation icons that sit at the top of the sidebar.
 * Uses the same glossy 3D icon style as the MacOS dock.
 * Shows active state with vibe orange indicator dot.
 *
 * ## Design Specification
 *
 * - **Position**: Top of sidebar, above folder list
 * - **Layout**: Horizontal row of icons (expanded) or vertical column (collapsed)
 * - **Size**: 44x44px icon buttons with 12x12 inner icons
 * - **Styling**:
 *   - Glossy white gradient background
 *   - Subtle border and shadow
 *   - Active state: small orange dot below
 * - **Separator**: Thin gray line below nav section
 *
 * @pattern sidebar-nav
 * @brand-version v4.1
 */

import * as React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { RiHome4Fill, RiChat1Fill, RiPriceTag3Fill, RiSettings3Fill } from '@remixicon/react';
import { cn } from '@/lib/utils';

interface NavItem {
  id: string;
  name: string;
  icon: React.ReactNode;
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

// Icon class for consistent styling with dark mode support
const iconClass = 'w-5 h-5 text-cb-black dark:text-cb-white';

const navItems: NavItem[] = [
  {
    id: 'home',
    name: 'Home',
    icon: <RiHome4Fill className={iconClass} />,
    path: '/',
    matchPaths: ['/', '/transcripts'],
  },
  {
    id: 'chat',
    name: 'AI Chat',
    icon: <RiChat1Fill className={iconClass} />,
    path: '/chat',
    matchPaths: ['/chat'],
  },
  {
    id: 'sorting',
    name: 'Sorting',
    icon: <RiPriceTag3Fill className={iconClass} />,
    path: '/sorting-tagging',
    matchPaths: ['/sorting-tagging'],
  },
  {
    id: 'settings',
    name: 'Settings',
    icon: <RiSettings3Fill className={iconClass} />,
    path: '/settings',
    matchPaths: ['/settings'],
  },
];

export function SidebarNav({ isCollapsed, className, onSyncClick, onLibraryToggle }: SidebarNavProps) {
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
              <button
                type="button"
                onClick={() => navigate(item.path)}
                className={cn(
                  'relative flex items-center',
                  isCollapsed ? 'justify-center w-11 h-11' : 'justify-start w-full px-3 h-10 gap-3',
                  'rounded-xl transition-all duration-200',
                  'hover:bg-gray-100 dark:hover:bg-white/10',
                  active && !isCollapsed && 'bg-gray-100 dark:bg-white/10 font-semibold',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-cb-vibe-orange focus-visible:ring-offset-2'
                )}
                title={item.name}
              >
                  {/* Icon Container */}
                  <div className={cn(
                      "flex-shrink-0 flex items-center justify-center",
                       isCollapsed ? "w-11 h-11" : "w-5 h-5"
                  )}>
                     {isCollapsed ? <NavIcon isActive={active}>{item.icon}</NavIcon> : item.icon}
                  </div>
                  
                  {/* Label - Visible only when expanded */}
                  {!isCollapsed && (
                      <span className="text-sm text-foreground truncate">{item.name}</span>
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
                'rounded-xl transition-all duration-200',
                'hover:bg-gray-100 dark:hover:bg-white/10',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-cb-vibe-orange focus-visible:ring-offset-2'
              )}
              title="Toggle Library"
            >
               <div className={cn(
                      "flex-shrink-0 flex items-center justify-center",
                       isCollapsed ? "w-11 h-11" : "w-5 h-5 text-muted-foreground"
                  )}>
                  {isCollapsed ? (
                      <NavIcon>
                         <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={iconClass}>
                            <path d="M3 4H21V20H3V4ZM5 6V18H19V6H5ZM7 8H17V10H7V8ZM7 11H17V13H7V11ZM7 14H17V16H7V14Z" /> 
                        </svg>
                      </NavIcon>
                  ) : (
                       <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                            <path d="M3 4H21V20H3V4ZM5 6V18H19V6H5ZM7 8H17V10H7V8ZM7 11H17V13H7V11ZM7 14H17V16H7V14Z" /> 
                        </svg>
                  )}
              </div>
              {!isCollapsed && <span className="text-sm text-foreground truncate">Library Panel</span>}
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
                'rounded-xl transition-all duration-200',
                'hover:bg-gray-100 dark:hover:bg-white/10',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-cb-vibe-orange focus-visible:ring-offset-2'
              )}
              title="Sync / Import"
            >
               <div className={cn(
                      "flex-shrink-0 flex items-center justify-center",
                       isCollapsed ? "w-11 h-11" : "w-5 h-5 text-cb-vibe-orange"
                  )}>
                   {isCollapsed ? (
                       <NavIcon>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={iconClass}>
                            <path d="M11 11V5H13V11H19V13H13V19H11V13H5V11H11Z" />
                        </svg>
                      </NavIcon>
                   ) : (
                       <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                            <path d="M11 11V5H13V11H19V13H13V19H11V13H5V11H11Z" />
                        </svg>
                   )}
                   
              </div>
              {!isCollapsed && <span className="text-sm font-medium text-foreground truncate">Sync & Import</span>}
            </button>
          </div>
        )}
      </div>

      {/* Separator line */}
      <div className="mx-3 border-t border-cb-border" />
    </div>
  );
}
