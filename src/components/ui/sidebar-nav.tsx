/**
 * Sidebar Navigation
 *
 * Navigation rail for the AppShell sidebar.
 * Clean, modern aesthetics with glossy 3D icons in collapsed mode.
 * Uses Remix Icons with line/fill variants for active states.
 *
 * Active state: 4-layer brand treatment (bg-vibe-orange/10 tint, fill icon
 * with text-vibe-orange color, font-semibold label, left-edge pill indicator).
 * Matches Linear's clean, obvious active-state feel.
 *
 * @pattern sidebar-nav
 * @brand-version v4.4
 */

import * as React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  RiPhoneLine,
  RiPhoneFill,
  RiDownloadLine,
  RiDownloadFill,
  RiSettings3Line,
  RiSettings3Fill,
  RiRouteLine,
  RiRouteFill,
  RiLayoutColumnLine,
  RiShareLine,
  RiShareFill,
} from '@remixicon/react';
import type { RemixiconComponentType } from '@remixicon/react';
import { cn } from '@/lib/utils';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { useUserRole } from '@/hooks/useUserRole';

interface NavItem {
  id: string;
  name: string;
  icon: RemixiconComponentType;
  iconActive: RemixiconComponentType;
  path: string;
  matchPaths?: string[];
}

interface SidebarNavProps {
  /** Whether the sidebar is collapsed */
  isCollapsed?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Optional callback to toggle the Library panel */
  onLibraryToggle?: () => void;
  /** Optional callback when Settings nav item is clicked (to open category pane) */
  onSettingsClick?: () => void;
}

const navItems: NavItem[] = [
  {
    id: 'home',
    name: 'All Calls',
    icon: RiPhoneLine,
    iconActive: RiPhoneFill,
    path: '/',
    matchPaths: ['/', '/transcripts'],
  },
  {
    id: 'shared-with-me',
    name: 'Shared With Me',
    icon: RiShareLine,
    iconActive: RiShareFill,
    path: '/shared-with-me',
    matchPaths: ['/shared-with-me'],
  },
  {
    id: 'import',
    name: 'Import',
    icon: RiDownloadLine,
    iconActive: RiDownloadFill,
    path: '/import',
    matchPaths: ['/import'],
  },
  {
    id: 'rules',
    name: 'Rules',
    icon: RiRouteLine,
    iconActive: RiRouteFill,
    path: '/rules',
    matchPaths: ['/rules', '/sorting-tagging/rules'],
  },
  {
    id: 'settings',
    name: 'Settings',
    icon: RiSettings3Line,
    iconActive: RiSettings3Fill,
    path: '/settings',
    matchPaths: ['/settings'],
  },
];

export function SidebarNav({ isCollapsed, className, onLibraryToggle, onSettingsClick }: SidebarNavProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { role } = useUserRole();
  const { isFeatureEnabled } = useFeatureFlags(role);

  // Filter nav items based on feature flags
  const filteredNavItems = React.useMemo(() => {
    return navItems.filter((item) => {
      if (item.id === 'import') return isFeatureEnabled('beta_imports');
      if (item.id === 'rules') return isFeatureEnabled('beta_imports');
      return true;
    });
  }, [isFeatureEnabled]);

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
      <nav
        className={cn(
          'flex flex-col gap-1 py-2',
          isCollapsed ? 'px-1' : 'px-2'
        )}
        role="navigation"
        aria-label="Main navigation"
      >
        {/* Nav items */}
        {filteredNavItems.map((item) => {
          const active = isActive(item);
          const Icon = active ? item.iconActive : item.icon;

          return (
            <div key={item.id} className="flex flex-col items-center">
              <button
                type="button"
                onClick={() => {
                  navigate(item.path);
                  if (item.id === 'settings' && onSettingsClick) {
                    onSettingsClick();
                  }
                }}
                className={cn(
                  'relative flex items-center gap-3 rounded-lg px-3 py-2',
                  'text-sm transition-colors duration-150',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isCollapsed
                    ? 'justify-center px-2 py-2 bg-transparent hover:bg-transparent'
                    : active
                      ? 'bg-vibe-orange/10 font-semibold text-vibe-orange'
                      : 'text-muted-foreground hover:bg-muted/70',
                  !isCollapsed && 'w-full',
                )}
                title={isCollapsed ? item.name : undefined}
                aria-current={active ? 'page' : undefined}
              >
                {/* Left-edge pill indicator for expanded active state */}
                {!isCollapsed && active && (
                  <span className="cv-side-indicator-pill" aria-hidden="true" />
                )}

                {/* Expanded: plain icon */}
                {!isCollapsed && (
                  <Icon
                    className={cn(
                      'w-4 h-4 flex-shrink-0',
                      active ? 'text-vibe-orange' : 'text-muted-foreground',
                    )}
                    aria-hidden="true"
                  />
                )}

                {/* Collapsed: glossy 3D icon button */}
                {isCollapsed && (
                  <div
                    className={cn(
                      'w-11 h-11 rounded-xl flex items-center justify-center',
                      'bg-gradient-to-br from-white to-gray-200',
                      'border border-gray-300/80',
                      'shadow-[inset_0_4px_6px_rgba(255,255,255,0.5),inset_0_-4px_6px_rgba(0,0,0,0.08),0_10px_20px_rgba(0,0,0,0.08)]',
                      'dark:from-gray-700 dark:to-gray-800 dark:border-border',
                      'dark:shadow-[inset_0_4px_6px_rgba(255,255,255,0.1),inset_0_-4px_6px_rgba(0,0,0,0.2),0_10px_20px_rgba(0,0,0,0.3)]',
                      active && 'ring-2 ring-vibe-orange/50',
                    )}
                  >
                    <Icon
                      className={cn(
                        'w-5 h-5 flex-shrink-0',
                        active ? 'text-vibe-orange' : 'text-foreground',
                      )}
                      aria-hidden="true"
                    />
                  </div>
                )}

                {!isCollapsed && <span className="truncate">{item.name}</span>}
              </button>

              {/* Orange dot below active collapsed icon */}
              {isCollapsed && active && (
                <div className="w-1.5 h-1.5 rounded-full bg-vibe-orange mx-auto mt-1" />
              )}
            </div>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className={cn('mt-2 flex flex-col gap-1 pt-2 border-t border-border/40', isCollapsed ? 'px-1' : 'px-2')}>
        {/* Panel toggle */}
        {onLibraryToggle && (
          <button
            type="button"
            onClick={onLibraryToggle}
            className={cn(
              'w-full flex items-center gap-3 rounded-lg px-3 py-2',
              'text-sm text-muted-foreground hover:bg-muted/70 transition-colors duration-150',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              isCollapsed && 'justify-center px-2 hover:bg-transparent',
            )}
            title={isCollapsed ? 'Toggle Workspace Panel' : undefined}
          >
            {isCollapsed ? (
              <div className={cn(
                'w-11 h-11 rounded-xl flex items-center justify-center',
                'bg-gradient-to-br from-white to-gray-200',
                'border border-gray-300/80',
                'shadow-[inset_0_4px_6px_rgba(255,255,255,0.5),inset_0_-4px_6px_rgba(0,0,0,0.08),0_10px_20px_rgba(0,0,0,0.08)]',
                'dark:from-gray-700 dark:to-gray-800 dark:border-border',
                'dark:shadow-[inset_0_4px_6px_rgba(255,255,255,0.1),inset_0_-4px_6px_rgba(0,0,0,0.2),0_10px_20px_rgba(0,0,0,0.3)]',
              )}>
                <RiLayoutColumnLine className="w-5 h-5 flex-shrink-0 text-foreground" aria-hidden="true" />
              </div>
            ) : (
              <RiLayoutColumnLine
                className="w-4 h-4 flex-shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
            )}
            {!isCollapsed && (
              <span className="truncate text-xs">Workspace Panel</span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
