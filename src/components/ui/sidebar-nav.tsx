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
  RiShieldStarLine,
  RiShieldStarFill,
} from '@remixicon/react';
import type { RemixiconComponentType } from '@remixicon/react';
import { cn } from '@/lib/utils';
import { useUserRole } from '@/hooks/useUserRole';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { SupportPopover } from '@/components/support/SupportPopover';
import { SelectionButton } from '@/components/ui/selection-button';

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
    name: 'CALLS',
    description: 'Your call library',
    icon: RiPhoneLine,
    iconActive: RiPhoneFill,
    path: '/',
    matchPaths: ['/', '/transcripts'],
    dataTour: 'nav-all-calls',
  },
  {
    id: 'import',
    name: 'IMPORT',
    description: 'Connect sources',
    icon: RiDownloadLine,
    iconActive: RiDownloadFill,
    path: '/import',
    matchPaths: ['/import'],
    dataTour: 'nav-import',
  },
  {
    id: 'rules',
    name: 'RULES',
    description: 'Auto-sort incoming calls',
    icon: RiRouteLine,
    iconActive: RiRouteFill,
    path: '/rules',
    matchPaths: ['/rules', '/sorting-tagging/rules'],
    dataTour: 'nav-rules',
  },
  {
    id: 'people',
    name: 'PEOPLE',
    description: 'Contacts & team',
    icon: RiGroupLine,
    iconActive: RiGroupFill,
    path: '/people',
    matchPaths: ['/people'],
    dataTour: 'nav-people',
  },
  {
    id: 'organization',
    name: 'ORGANIZATION',
    description: 'Manage your organization',
    icon: RiBuilding4Line,
    iconActive: RiBuilding4Fill,
    path: '/organization',
    matchPaths: ['/organization'],
  },
  {
    id: 'admin',
    name: 'ADMIN',
    description: 'System administration',
    icon: RiShieldStarLine,
    iconActive: RiShieldStarFill,
    path: '/admin/dashboard',
    matchPaths: ['/admin'],
  },
];

const settingsItem: NavItem = {
  id: 'settings',
  name: 'SETTINGS',
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
  const { isAdmin } = useUserRole();

  // ADMIN entry is only visible to platform admins (16-01).
  const visibleNavItems = React.useMemo(
    () => navItems.filter((item) => item.id !== 'admin' || isAdmin),
    [isAdmin],
  );

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
        {visibleNavItems.map((item) => {
          const active = isActive(item);
          const Icon = active ? item.iconActive : item.icon;
          const renderedIcon = (
            <Icon
              className={cn(
                'h-4 w-4 transition-colors',
                active ? 'text-foreground' : 'text-muted-foreground',
              )}
              aria-hidden="true"
            />
          );

          return (
            <div key={item.id} role="listitem" className="relative mb-0.5">
              {!isCollapsed ? (
                <SelectionButton
                  selected={active}
                  icon={renderedIcon}
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
                      'bg-muted border border-border shadow-sm',
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
                        ? 'ring-1 ring-vibe-orange border-transparent'
                        : 'border border-border',
                    )}
                    aria-hidden="true"
                  >
                    {renderedIcon}
                  </div>
                </button>
              )}
            </div>
          );
        })}
      </nav>

      {/* Bottom section — pinned to bottom */}
      <div className="mt-auto flex flex-col gap-0.5 pt-2 px-2">
        <NotificationBell isCollapsed={isCollapsed} />
        <SupportPopover isCollapsed={isCollapsed} />

        {/* Settings — always last */}
        {(() => {
          const active = isActive(settingsItem);
          const SettingsIcon = active ? settingsItem.iconActive : settingsItem.icon;
          const settingsIconNode = (
            <SettingsIcon
              className={cn(
                'h-4 w-4 transition-colors',
                active ? 'text-foreground' : 'text-muted-foreground',
              )}
              aria-hidden="true"
            />
          );
          if (!isCollapsed) {
            return (
              <SelectionButton
                selected={active}
                icon={settingsIconNode}
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
                  'bg-muted border border-border shadow-sm',
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
                    ? 'ring-1 ring-vibe-orange border-transparent'
                    : 'border border-border',
                )}
                aria-hidden="true"
              >
                {settingsIconNode}
              </div>
            </button>
          );
        })()}
      </div>

    </div>
  );
}
