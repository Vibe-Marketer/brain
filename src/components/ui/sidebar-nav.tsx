/**
 * Sidebar Navigation
 *
 * Navigation rail for the AppShell sidebar.
 * Matches the 2nd pane design pattern exactly:
 * - Icon in w-8 h-8 rounded-md bordered box
 * - Active state: bg-muted (muted) background, NOT orange tint
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
  RiGroupLine,
  RiGroupFill,
  RiBuilding4Line,
  RiBuilding4Fill,
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
  onSettingsClick?: () => void;
}

const navItems: NavItem[] = [
  {
    id: 'home',
    name: 'Calls',
    description: 'Your call library',
    icon: RiPhoneLine,
    iconActive: RiPhoneFill,
    path: '/',
    matchPaths: ['/', '/transcripts'],
    dataTour: 'nav-all-calls',
  },
  {
    id: 'people',
    name: 'People',
    description: 'Contacts & team',
    icon: RiGroupLine,
    iconActive: RiGroupFill,
    path: '/people',
    matchPaths: ['/people'],
    dataTour: 'nav-people',
  },
  {
    id: 'organization',
    name: 'Organization',
    description: 'Manage your organization',
    icon: RiBuilding4Line,
    iconActive: RiBuilding4Fill,
    path: '/organization',
    matchPaths: ['/organization'],
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
];

const settingsItem: NavItem = {
  id: 'settings',
  name: 'Settings',
  description: 'Account and preferences',
  icon: RiSettings3Line,
  iconActive: RiSettings3Fill,
  path: '/settings',
  matchPaths: ['/settings'],
  dataTour: 'nav-settings',
};

export function SidebarNav({ isCollapsed, className, onSettingsClick }: SidebarNavProps) {
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
    <div className={cn('flex-shrink-0 flex flex-col h-full', className)}>
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
                  // Base
                  'relative flex items-center rounded-lg',
                  'text-left transition-all duration-150 ease-in-out',
                  'hover:bg-muted/70',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-vibe-orange focus-visible:ring-offset-2',
                  // Expanded: full width with gap
                  !isCollapsed && 'w-full px-3 py-3 gap-3',
                  // Collapsed: square button, centered
                  isCollapsed && 'w-14 h-14 justify-center items-center mx-auto',
                  // Active — bg-muted, pill via before:
                  active && [
                    'bg-muted',
                    !isCollapsed && 'pl-4', // offset for pill when expanded
                    "before:content-[''] before:absolute before:left-1 before:top-1/2 before:-translate-y-1/2 before:w-1 before:h-[65%] before:rounded-full before:bg-vibe-orange",
                  ],
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

                {/* Label + description — hidden on collapse */}
                {!isCollapsed && (
                <div
                  className="flex-1 min-w-0 overflow-hidden"
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
                )}

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

      {/* Bottom section — pinned to bottom */}
      <div className="mt-auto flex flex-col gap-0.5 pt-2 px-2">
        <button
          type="button"
          onClick={startTour}
          className={cn(
            'relative flex items-center rounded-lg',
            'text-muted-foreground hover:bg-muted/70 transition-colors duration-150',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            !isCollapsed && 'w-full px-3 py-2.5 gap-3',
            isCollapsed && 'w-14 h-14 justify-center items-center mx-auto',
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
            'relative flex items-center rounded-lg',
            'text-muted-foreground hover:bg-muted/70 transition-colors duration-150',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            !isCollapsed && 'w-full px-3 py-2.5 gap-3',
            isCollapsed && 'w-14 h-14 justify-center items-center mx-auto',
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

        {/* Settings — always last */}
        {(() => {
          const active = isActive(settingsItem);
          const Icon = active ? settingsItem.iconActive : settingsItem.icon;
          return (
            <button
              type="button"
              data-tour={settingsItem.dataTour}
              onClick={() => {
                navigate(settingsItem.path);
                if (onSettingsClick) onSettingsClick();
              }}
              className={cn(
                'relative flex items-center rounded-lg',
                'text-left transition-all duration-150 ease-in-out',
                'hover:bg-muted/70',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-vibe-orange focus-visible:ring-offset-2',
                !isCollapsed && 'w-full px-3 py-3 gap-3',
                isCollapsed && 'w-14 h-14 justify-center items-center mx-auto',
                active && [
                  'bg-muted',
                  !isCollapsed && 'pl-4',
                  "before:content-[''] before:absolute before:left-1 before:top-1/2 before:-translate-y-1/2 before:w-1 before:h-[65%] before:rounded-full before:bg-vibe-orange",
                ],
              )}
              title={settingsItem.name}
              aria-label={isCollapsed ? settingsItem.name : undefined}
              aria-current={active ? 'page' : undefined}
            >
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
              {!isCollapsed && (
              <div
                className="flex-1 min-w-0 overflow-hidden"
              >
                <span
                  className={cn(
                    'block text-sm font-medium truncate transition-colors duration-300',
                    active ? 'text-foreground' : 'text-foreground',
                  )}
                >
                  {settingsItem.name}
                </span>
                <span className="block text-xs text-muted-foreground truncate">
                  {settingsItem.description}
                </span>
              </div>
              )}
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
          );
        })()}
      </div>

      <HowItWorksModal
        open={showHowItWorks}
        onComplete={() => setShowHowItWorks(false)}
      />
    </div>
  );
}
