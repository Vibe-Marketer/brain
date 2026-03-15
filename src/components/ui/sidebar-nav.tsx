/**
 * Sidebar Navigation
 *
 * Navigation rail for the AppShell sidebar.
 * Unified design: same icon size/position in both collapsed and expanded states.
 * Text label smoothly fades and clips to zero width on collapse — icon never moves.
 *
 * Active state: bg-vibe-orange/10 tint, fill icon, font-semibold label, left-edge pill.
 *
 * @pattern sidebar-nav
 * @brand-version v4.5
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
  RiQuestionLine,
  RiInformationLine,
} from '@remixicon/react';
import type { RemixiconComponentType } from '@remixicon/react';
import { cn } from '@/lib/utils';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { useUserRole } from '@/hooks/useUserRole';
import { startTour } from '@/lib/tour';
import { HowItWorksModal } from '@/components/onboarding/HowItWorksModal';

interface NavItem {
  id: string;
  name: string;
  icon: RemixiconComponentType;
  iconActive: RemixiconComponentType;
  path: string;
  matchPaths?: string[];
  dataTour?: string;
}

interface SidebarNavProps {
  /** Whether the sidebar is collapsed */
  isCollapsed?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Optional callback to toggle the Library panel */
  onLibraryToggle?: () => void;
  /** Optional callback when Settings nav item is clicked */
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
    dataTour: 'nav-all-calls',
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
    dataTour: 'nav-import',
  },
  {
    id: 'rules',
    name: 'Rules',
    icon: RiRouteLine,
    iconActive: RiRouteFill,
    path: '/rules',
    matchPaths: ['/rules', '/sorting-tagging/rules'],
    dataTour: 'nav-rules',
  },
  {
    id: 'settings',
    name: 'Settings',
    icon: RiSettings3Line,
    iconActive: RiSettings3Fill,
    path: '/settings',
    matchPaths: ['/settings'],
    dataTour: 'nav-settings',
  },
];

export function SidebarNav({ isCollapsed, className, onLibraryToggle, onSettingsClick }: SidebarNavProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { role } = useUserRole();
  const { isFeatureEnabled } = useFeatureFlags(role);
  const [showHowItWorks, setShowHowItWorks] = React.useState(false);

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
        className="flex flex-col gap-0.5 py-2 px-2"
        role="navigation"
        aria-label="App navigation"
      >
        {filteredNavItems.map((item) => {
          const active = isActive(item);
          const Icon = active ? item.iconActive : item.icon;

          return (
            <button
              key={item.id}
              type="button"
              data-tour={item.dataTour}
              onClick={() => {
                navigate(item.path);
                if (item.id === 'settings' && onSettingsClick) {
                  onSettingsClick();
                }
              }}
              className={cn(
                // Base: always full-width row, icon on left, text on right
                'relative w-full flex items-center gap-3 rounded-lg px-3 py-2',
                'text-sm transition-colors duration-150',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                active
                  ? 'bg-vibe-orange/10 font-semibold text-vibe-orange'
                  : 'text-muted-foreground hover:bg-muted/70',
              )}
              aria-label={isCollapsed ? item.name : undefined}
              aria-current={active ? 'page' : undefined}
            >
              {/* Left-edge pill — always reserve the space so icon doesn't shift */}
              <span
                className={cn(
                  'absolute left-0 top-1/2 -translate-y-1/2 w-0.5 rounded-r-full bg-vibe-orange',
                  'transition-all duration-300',
                  active && !isCollapsed ? 'h-5 opacity-100' : 'h-0 opacity-0',
                )}
                aria-hidden="true"
              />

              {/* Icon — fixed size, fixed position, never changes */}
              <Icon
                className={cn(
                  'w-4 h-4 flex-shrink-0',
                  active ? 'text-vibe-orange' : 'text-muted-foreground',
                )}
                aria-hidden="true"
              />

              {/* Label — clips to zero width on collapse, fades smoothly */}
              <span
                className={cn(
                  'truncate transition-all duration-300 ease-in-out',
                  isCollapsed
                    ? 'w-0 opacity-0 overflow-hidden'
                    : 'opacity-100',
                )}
              >
                {item.name}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="mt-2 flex flex-col gap-0.5 pt-2 border-t border-border/40 px-2">
        {/* Workspace panel toggle */}
        {onLibraryToggle && (
          <button
            type="button"
            onClick={onLibraryToggle}
            className={cn(
              'w-full flex items-center gap-3 rounded-lg px-3 py-2',
              'text-sm text-muted-foreground hover:bg-muted/70 transition-colors duration-150',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            )}
            aria-label={isCollapsed ? 'Toggle Workspace Panel' : undefined}
          >
            <RiLayoutColumnLine className="w-4 h-4 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
            <span
              className={cn(
                'truncate text-xs transition-all duration-300 ease-in-out',
                isCollapsed ? 'w-0 opacity-0 overflow-hidden' : 'opacity-100',
              )}
            >
              Workspace Panel
            </span>
          </button>
        )}

        {/* Tour button */}
        <button
          type="button"
          onClick={startTour}
          title="Take the tour"
          className={cn(
            'w-full flex items-center gap-3 rounded-lg px-3 py-2',
            'text-sm text-muted-foreground hover:bg-muted/70 transition-colors duration-150',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          )}
          aria-label="Take the tour"
        >
          <RiQuestionLine className="w-4 h-4 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
          <span
            className={cn(
              'truncate text-xs transition-all duration-300 ease-in-out',
              isCollapsed ? 'w-0 opacity-0 overflow-hidden' : 'opacity-100',
            )}
          >
            Take the tour
          </span>
        </button>

        {/* How it works button */}
        <button
          type="button"
          onClick={() => setShowHowItWorks(true)}
          title="How it works"
          className={cn(
            'w-full flex items-center gap-3 rounded-lg px-3 py-2',
            'text-sm text-muted-foreground hover:bg-muted/70 transition-colors duration-150',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          )}
          aria-label="How it works"
        >
          <RiInformationLine className="w-4 h-4 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
          <span
            className={cn(
              'truncate text-xs transition-all duration-300 ease-in-out',
              isCollapsed ? 'w-0 opacity-0 overflow-hidden' : 'opacity-100',
            )}
          >
            How it works
          </span>
        </button>
      </div>

      <HowItWorksModal
        open={showHowItWorks}
        onComplete={() => setShowHowItWorks(false)}
      />
    </div>
  );
}
