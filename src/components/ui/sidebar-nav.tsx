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
import { SelectionButton } from '@/components/ui/selection-button';

interface NavItem {
  id: string;
  name: string;
  description: string;
  icon: RemixiconComponentType;
  iconActive: RemixiconComponentType;
  emoji: string;
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
    emoji: '📞',
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
    emoji: '👥',
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
    emoji: '🏢',
    path: '/organization',
    matchPaths: ['/organization'],
  },
  {
    id: 'import',
    name: 'Import',
    description: 'Connect sources',
    icon: RiDownloadLine,
    iconActive: RiDownloadFill,
    emoji: '📥',
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
    emoji: '🔀',
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
  emoji: '⚙️',
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
          const emojiIcon = (
            <span className="text-[15px] leading-none" role="img" aria-label={item.name}>
              {item.emoji}
            </span>
          );

          return (
            <div key={item.id} role="listitem" className="relative mb-0.5">
              {!isCollapsed ? (
                <SelectionButton
                  selected={active}
                  icon={emojiIcon}
                  label={item.name}
                  description={item.description}
                  size="sm"
                  showChevron
                  onClick={() => {
                    navigate(item.path);
                    if (item.id === 'settings' && onSettingsClick) {
                      onSettingsClick();
                    }
                  }}
                  data-tour={item.dataTour}
                  title={item.name}
                  aria-current={active ? 'page' : undefined}
                />
              ) : (
                // Collapsed rail: square icon button + pill (no SelectionButton —
                // it expects a label that wouldn't render anyway)
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
                    'relative flex items-center rounded-lg',
                    'text-left transition-all duration-150 ease-in-out',
                    'hover:bg-muted/70',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-vibe-orange focus-visible:ring-offset-2',
                    'w-14 h-14 justify-center items-center mx-auto',
                    active && [
                      'bg-muted',
                      "before:content-[''] before:absolute before:left-1 before:top-1/2 before:-translate-y-1/2 before:w-1 before:h-[65%] before:rounded-full before:bg-vibe-orange",
                    ],
                  )}
                  title={item.name}
                  aria-label={item.name}
                  aria-current={active ? 'page' : undefined}
                >
                  <div
                    className={cn(
                      'w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0',
                      'bg-card',
                      'transition-all duration-300 ease-in-out',
                      active
                        ? 'ring-2 ring-vibe-orange border-transparent'
                        : 'border border-border',
                    )}
                    aria-hidden="true"
                  >
                    {emojiIcon}
                  </div>
                </button>
              )}
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
            <span className="text-[15px] leading-none" role="img" aria-label="Tour">❓</span>
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
            <span className="text-[15px] leading-none" role="img" aria-label="Info">ℹ️</span>
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
          const emojiIcon = (
            <span className="text-[15px] leading-none" role="img" aria-label="Settings">
              {settingsItem.emoji}
            </span>
          );
          if (!isCollapsed) {
            return (
              <SelectionButton
                selected={active}
                icon={emojiIcon}
                label={settingsItem.name}
                description={settingsItem.description}
                size="sm"
                showChevron
                onClick={() => {
                  navigate(settingsItem.path);
                  if (onSettingsClick) onSettingsClick();
                }}
                data-tour={settingsItem.dataTour}
                title={settingsItem.name}
                aria-current={active ? 'page' : undefined}
              />
            );
          }
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
                'w-14 h-14 justify-center items-center mx-auto',
                active && [
                  'bg-muted',
                  "before:content-[''] before:absolute before:left-1 before:top-1/2 before:-translate-y-1/2 before:w-1 before:h-[65%] before:rounded-full before:bg-vibe-orange",
                ],
              )}
              title={settingsItem.name}
              aria-label={settingsItem.name}
              aria-current={active ? 'page' : undefined}
            >
              <div
                className={cn(
                  'w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0',
                  'bg-card',
                  'transition-all duration-300 ease-in-out',
                  active
                    ? 'ring-2 ring-vibe-orange border-transparent'
                    : 'border border-border',
                )}
                aria-hidden="true"
              >
                {emojiIcon}
              </div>
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
