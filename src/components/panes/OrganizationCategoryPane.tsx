import * as React from 'react';
import { cn } from '@/lib/utils';
import { OrganizationSwitcher } from '@/components/header/OrganizationSwitcher';
import {
  RiBuilding4Line,
  RiDashboardLine,
  RiStackLine,
  RiGroupLine,
} from '@remixicon/react';

export type OrganizationCategoryId = 'overview' | 'workspaces' | 'members';

export interface OrganizationCategoryPaneProps {
  selectedCategory: OrganizationCategoryId | null;
  onSelectCategory: (category: OrganizationCategoryId) => void;
}

interface CategoryDef {
  id: OrganizationCategoryId;
  label: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
}

const CATEGORIES: CategoryDef[] = [
  {
    id: 'overview',
    label: 'Overview',
    subtitle: 'Organization info',
    icon: RiDashboardLine,
  },
  {
    id: 'workspaces',
    label: 'Workspaces',
    subtitle: 'Manage workspaces',
    icon: RiStackLine,
  },
  {
    id: 'members',
    label: 'Members',
    subtitle: 'Team & roles',
    icon: RiGroupLine,
  },
];

export function OrganizationCategoryPane({
  selectedCategory,
  onSelectCategory,
}: OrganizationCategoryPaneProps) {
  return (
    <div className="h-full flex flex-col">
      <header className="px-4 py-4 space-y-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-cb-border/40 flex items-center justify-center">
              <RiBuilding4Line className="h-4.5 w-4.5 text-vibe-orange" />
            </div>
            <div>
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground leading-none">Org</h2>
              <p className="text-[9px] text-muted-foreground/60 uppercase">Management</p>
            </div>
          </div>
        </div>

        <div className="p-2 border border-border rounded-xl bg-card">
          <div className="flex items-center gap-1 mb-2 px-1">
            <div className="w-1.5 h-1.5 rounded-full bg-success-bg shadow-[0_0_8px_rgba(var(--success-bg),0.5)]" />
            <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/80">Organization</span>
          </div>
          <OrganizationSwitcher />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-3 flex flex-col">
        <div className="flex flex-col gap-0.5">
          {CATEGORIES.map(({ id, label, subtitle, icon: Icon }) => {
            const isActive = selectedCategory === id;

            return (
              <button
                key={id}
                type="button"
                onClick={() => onSelectCategory(id)}
                className={cn(
                  'relative w-full flex items-start gap-2.5 px-3 py-2 rounded-md text-left',
                  'text-sm transition-colors duration-150',
                  isActive
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                )}
                aria-current={isActive ? 'true' : undefined}
              >
                {isActive && (
                  <span
                    className="absolute left-1 top-1/2 -translate-y-1/2 w-1 h-3/5 rounded-r-full bg-vibe-orange"
                    aria-hidden="true"
                  />
                )}
                <Icon
                  size={15}
                  className={cn(
                    'flex-shrink-0 transition-colors mt-0.5',
                    isActive ? 'text-vibe-orange' : 'text-muted-foreground',
                  )}
                />
                <div className="flex-1 min-w-0">
                  <span className="block truncate font-medium">{label}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {subtitle}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default OrganizationCategoryPane;
