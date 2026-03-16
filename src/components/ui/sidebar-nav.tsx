/**
 * Sidebar Navigation
 *
 * Navigation rail for the AppShell sidebar.
 * Matches the 2nd pane design pattern exactly:
 * - Icon in w-8 h-8 rounded-md bordered box
 * - Active state: bg-hover (muted) background, NOT orange tint
 * - Left pill via before: pseudo at left-1, h-[65%], bg-vibe-orange
 * - pl-4 offset on active to clear the pill
 * - Right chevron fades in on active
 * - Collapsed: icon box centered, same pill treatment, text clips away
 *
 * @pattern sidebar-nav
 * @brand-version v4.6
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
  description: string;
  icon: RemixiconComponentType;
  iconActive: RemixiconComponentType;
  path: string;
  matchPaths?: string[];
  dataTour?: string;
}

interface SidebarNavProps {
  isCollapsed?: boolean;
  className?: string;
  onLibraryToggle?: () => void;
  onSettingsClick?: () => void;
}

const navItems: NavItem[] = [
  {
    id: 'home',
    name: 'All Calls',
    description: 'Your call library',
    icon: RiPhoneLine,
    iconActive: RiPhoneFill,
    path: '/',
    matchPaths: ['/', '/transcripts'],
    dataTour: 'nav-all-calls',
  },
  {
    id: 'shared-with-me',
    name: 'Shared With Me',
    description: 'Calls others shared',
    icon: RiShareLine,
    iconActive: RiShareFill,
    path: '/shared-with-me',
    matchPaths: ['/shared-with-me'],
  },
  {
    id: 'import',
    name: 'Import',
    description: 'Connect sources',
    icon: RiDownloadLine,
    iconActive: RiDownloadFill,
    path: '/import',
    matchPaths: ['/import'],
    dataTour: 'nav-import',
  },
  {
    id: 'rules',
    name: 'Rules',
    description: 'Auto-sort incoming calls',
    icon: RiRouteLine,
    iconActive: RiRouteFill,
    path: '/rules',
    matchPaths: ['/rules', '/sorting-tagging/rules'],
    dataTour: 'nav-rules',
  },
  {
    id: 'settings',
    name: 'Settings',
    description: 'Account and preferences',
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
            <div key={item.id} role="listitem" className="relative mb-0.5">
              <button
                type="button"
                data-tour={item.dataTour}
                onClick={() => {
                  navigate(item.path);
                  if (item.id === 'settings' && onSettingsClick) {
                    onSettingsClick();
                  }
                }}
                className={cn(
                  // Base — matches 2nd pane button exactly
                  'relative w-full flex items-center gap-3 px-3 py-3 rounded-lg',
                  'text-left transition-all duration-150 ease-in-out',
                  'hover:bg-muted/70',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-vibe-orange focus-visible:ring-offset-2',
                  // Active — bg-hover (muted), NOT orange tint. Pill via before:
                  active && [
                    'bg-muted',
                    isCollapsed ? 'pl-3' : 'pl-4', // offset for pill when expanded
                    "before:content-[''] before:absolute before:left-1 before:top-1/2 before:-translate-y-1/2 before:w-1 before:h-[65%] before:rounded-full before:bg-vibe-orange",
                  ],
                  // Collapsed: center the icon box
                  isCollapsed && 'justify-center',
                )}
                title={item.name}
                aria-label={isCollapsed ? item.name : undefined}
                aria-current={active ? 'page' : undefined}
              >
                {/* Icon box — w-8 h-8 rounded-md bordered, matches 2nd pane */}
                <div
                  className={cn(
                    'w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0',
                    'bg-card border border-border',
                    'transition-all duration-300 ease-in-out',
                    active && 'bg-muted border-border',
                  )}
                  aria-hidden="true"
                >
                  <Icon
                    className={cn(
                      'h-4 w-4 transition-colors duration-300 ease-in-out',
                      active ? 'text-vibe-orange' : 'text-muted-foreground',
                    )}
                  />
                </div>

                {/* Label + description — clip to zero on collapse */}
                <div
                  className={cn(
                    'flex-1 min-w-0 transition-all duration-300 ease-in-out overflow-hidden',
                    isCollapsed ? 'w-0 opacity-0' : 'opacity-100',
                  )}
                >
                  <span
                    className={cn(
                      'block text-sm font-medium truncate transition-colors duration-300',
                      active ? 'text-foreground' : 'text-foreground',
                    )}
                  >
                    {item.name}
                  </span>
                  <span className="block text-xs text-muted-foreground truncate">
                    {item.description}
                  </span>
                </div>

                {/* Right chevron — fades in on active, matches 2nd pane */}
                {!isCollapsed && (
                  <div
                    className={cn(
                      'flex-shrink-0 transition-all duration-300 ease-in-out',
                      active ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-1',
                    )}
                    aria-hidden="true"
                  >
                    <svg
                      className="h-4 w-4 text-muted-foreground"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                )}
              </button>
            </div>
          );
        })}
      </nav>

      {/* Bottom utility buttons */}
      <div className="mt-2 flex flex-col gap-0.5 pt-2 border-t border-border/40 px-2">
        {onLibraryToggle && (
          <button
            type="button"
            onClick={onLibraryToggle}
            className={cn(
              'relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg',
              'text-muted-foreground hover:bg-muted/70 transition-colors duration-150',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              isCollapsed && 'justify-center',
            )}
            aria-label={isCollapsed ? 'Toggle Workspace Panel' : undefined}
          >
            <div className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 bg-card border border-border" aria-hidden="true">
              <RiLayoutColumnLine className="h-4 w-4 text-muted-foreground" />
            </div>
            <span
              className={cn(
                'text-xs font-medium transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap',
                isCollapsed ? 'w-0 opacity-0' : 'opacity-100',
              )}
            >
              Workspace Panel
            </span>
          </button>
        )}

        <button
          type="button"
          onClick={startTour}
          className={cn(
            'relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg',
            'text-muted-foreground hover:bg-muted/70 transition-colors duration-150',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            isCollapsed && 'justify-center',
          )}
          aria-label="Take the tour"
        >
          <div className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 bg-card border border-border" aria-hidden="true">
            <RiQuestionLine className="h-4 w-4 text-muted-foreground" />
          </div>
          <span
            className={cn(
              'text-xs font-medium transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap',
              isCollapsed ? 'w-0 opacity-0' : 'opacity-100',
            )}
          >
            Take the tour
          </span>
        </button>

        <button
          type="button"
          onClick={() => setShowHowItWorks(true)}
          className={cn(
            'relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg',
            'text-muted-foreground hover:bg-muted/70 transition-colors duration-150',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            isCollapsed && 'justify-center',
          )}
          aria-label="How it works"
        >
          <div className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 bg-card border border-border" aria-hidden="true">
            <RiInformationLine className="h-4 w-4 text-muted-foreground" />
          </div>
          <span
            className={cn(
              'text-xs font-medium transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap',
              isCollapsed ? 'w-0 opacity-0' : 'opacity-100',
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
