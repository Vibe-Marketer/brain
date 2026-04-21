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
      <header className="px-4 py-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 bg-card border border-border">
              <RiBuilding4Line className="h-4 w-4 text-vibe-orange" />
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
                    ? [
                        'bg-muted text-foreground',
                        "before:content-[''] before:absolute before:left-1 before:top-1/2 before:-translate-y-1/2 before:w-1 before:h-[65%] before:rounded-full before:bg-vibe-orange",
                      ]
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                )}
                aria-current={isActive ? 'true' : undefined}
              >
                <div className={cn(
                  'w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 bg-card border border-border',
                )}>
                  <Icon
                    className={cn(
                      'h-4 w-4 transition-colors',
                      isActive ? 'text-foreground' : 'text-muted-foreground',
                    )}
                  />
                </div>
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

      <footer className="shrink-0 px-4 py-2" />
    </div>
  );
}

export default OrganizationCategoryPane;
