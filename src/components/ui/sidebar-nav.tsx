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

export function SidebarNav({ isCollapsed, className }: SidebarNavProps) {
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
          isCollapsed ? 'flex-col items-center' : 'flex-row justify-center'
        )}
      >
        {navItems.map((item) => {
          const active = isActive(item);
          return (
            <div key={item.id} className="relative flex flex-col items-center">
              <button
                type="button"
                onClick={() => navigate(item.path)}
                className={cn(
                  'relative flex items-center justify-center',
                  'w-11 h-11 rounded-xl',
                  'transition-all duration-200',
                  'hover:scale-105',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-cb-vibe-orange focus-visible:ring-offset-2'
                )}
                title={item.name}
                aria-label={item.name}
              >
                <NavIcon isActive={active}>{item.icon}</NavIcon>
              </button>
              {/* Active indicator dot */}
              {active && (
                <div className="absolute -bottom-0.5 w-1.5 h-1.5 rounded-full bg-cb-vibe-orange" />
              )}
            </div>
          );
        })}
      </div>

      {/* Separator line */}
      <div className="mx-3 border-t border-cb-border" />
    </div>
  );
}
