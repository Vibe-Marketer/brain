/**
 * MobileTabBar — Persistent bottom navigation for mobile viewports only (< 768px)
 *
 * Shows 3–5 destinations based on feature flags.  Active tab uses the fill icon
 * variant + vibe-orange colour.  Safe-area padding is applied so the bar clears
 * the home indicator on iOS.
 *
 * Desktop and tablet: this component is never rendered.
 *
 * @pattern mobile-tab-bar
 * @brand-version v1.0
 */

import * as React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  RiPhoneLine,
  RiPhoneFill,
  RiShareLine,
  RiShareFill,
  RiDownloadLine,
  RiDownloadFill,
  RiRouteLine,
  RiRouteFill,
  RiSettings3Line,
  RiSettings3Fill,
} from '@remixicon/react';
import type { RemixiconComponentType } from '@remixicon/react';
import { cn } from '@/lib/utils';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { useUserRole } from '@/hooks/useUserRole';

interface TabItem {
  id: string;
  label: string;
  icon: RemixiconComponentType;
  iconActive: RemixiconComponentType;
  path: string;
  /** Additional paths that count as "active" for this tab */
  matchPaths?: string[];
  /** Feature flag id — tab only appears when flag is enabled */
  featureFlag?: string;
}

const TAB_ITEMS: TabItem[] = [
  {
    id: 'home',
    label: 'All Calls',
    icon: RiPhoneLine,
    iconActive: RiPhoneFill,
    path: '/',
    matchPaths: ['/', '/transcripts'],
  },
  {
    id: 'shared-with-me',
    label: 'Shared',
    icon: RiShareLine,
    iconActive: RiShareFill,
    path: '/shared-with-me',
    matchPaths: ['/shared-with-me'],
  },
  {
    id: 'import',
    label: 'Import',
    icon: RiDownloadLine,
    iconActive: RiDownloadFill,
    path: '/import',
    matchPaths: ['/import'],
    featureFlag: 'beta_imports',
  },
  {
    id: 'rules',
    label: 'Rules',
    icon: RiRouteLine,
    iconActive: RiRouteFill,
    path: '/rules',
    matchPaths: ['/rules', '/sorting-tagging/rules'],
    featureFlag: 'beta_imports',
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: RiSettings3Line,
    iconActive: RiSettings3Fill,
    path: '/settings',
    matchPaths: ['/settings'],
  },
];

export function MobileTabBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { role } = useUserRole();
  const { isFeatureEnabled } = useFeatureFlags(role);

  const visibleTabs = React.useMemo(
    () =>
      TAB_ITEMS.filter((tab) =>
        tab.featureFlag ? isFeatureEnabled(tab.featureFlag) : true,
      ),
    [isFeatureEnabled],
  );

  const isActive = React.useCallback(
    (tab: TabItem): boolean => {
      const paths = tab.matchPaths ?? [tab.path];
      return paths.some((p) =>
        p === '/' ? location.pathname === '/' : location.pathname.startsWith(p),
      );
    },
    [location.pathname],
  );

  return (
    <nav
      aria-label="Bottom navigation"
      className={cn(
        'fixed bottom-0 left-0 right-0 z-30',
        'bg-card border-t border-border/60',
        'flex items-stretch',
        // Safe-area bottom padding for iOS home indicator
        '[padding-bottom:env(safe-area-inset-bottom,0px)]',
      )}
      style={{ height: 'calc(56px + env(safe-area-inset-bottom, 0px))' }}
    >
      {visibleTabs.map((tab) => {
        const active = isActive(tab);
        const Icon = active ? tab.iconActive : tab.icon;

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => navigate(tab.path)}
            aria-label={tab.label}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 flex-1 py-2',
              'text-[10px] font-medium',
              'transition-colors duration-150',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
              active ? 'text-vibe-orange' : 'text-muted-foreground',
            )}
          >
            <Icon
              className={cn(
                'w-5 h-5 flex-shrink-0',
                active ? 'text-vibe-orange' : 'text-muted-foreground',
              )}
              aria-hidden="true"
            />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
