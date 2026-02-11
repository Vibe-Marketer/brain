import { RiFlashlightLine, RiFlowChart, RiPlayCircleLine } from "@remixicon/react";
import type { ComponentType } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type AutomationFilter = "all" | "active" | "inactive";

interface AutomationRulesPaneProps {
  activeFilter: AutomationFilter;
  onFilterChange: (filter: AutomationFilter) => void;
  stats: {
    total: number;
    active: number;
    totalRuns: number;
  };
}

export function AutomationRulesPane({ activeFilter, onFilterChange, stats }: AutomationRulesPaneProps) {
  const items: Array<{ id: AutomationFilter; label: string; icon: ComponentType<{ className?: string }>; count: number }> = [
    { id: "all", label: "All Rules", icon: RiFlowChart, count: stats.total },
    { id: "active", label: "Active", icon: RiPlayCircleLine, count: stats.active },
    { id: "inactive", label: "Inactive", icon: RiFlashlightLine, count: Math.max(stats.total - stats.active, 0) },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <header className="px-4 py-3 border-b border-border bg-card/50">
        <h2 className="text-sm font-bold text-ink uppercase tracking-wide">Rule Filters</h2>
        <p className="text-xs text-ink-muted mt-0.5">Narrow rules by state</p>
      </header>

      <div className="p-3 border-b border-border space-y-2">
        <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Runs</p>
          <p className="text-lg font-semibold tabular-nums text-foreground">{stats.totalRuns.toLocaleString()}</p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-2 space-y-1">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeFilter === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onFilterChange(item.id)}
              className={cn(
                "w-full flex items-center justify-between rounded-lg px-3 py-2.5 text-left transition-colors",
                isActive ? "bg-hover border border-border" : "hover:bg-hover/70 border border-transparent"
              )}
            >
              <span className="flex items-center gap-2 min-w-0">
                <Icon className={cn("h-4 w-4", isActive ? "text-vibe-orange" : "text-muted-foreground")} />
                <span className={cn("text-sm truncate", isActive ? "text-foreground font-medium" : "text-muted-foreground")}>{item.label}</span>
              </span>
              <Badge variant="secondary" className="text-xs">{item.count}</Badge>
            </button>
          );
        })}
      </div>
    </div>
  );
}
