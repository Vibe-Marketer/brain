import { RiFilter3Line, RiGroupLine, RiLinksLine, RiSearchLine } from "@remixicon/react";
import type { ComponentType } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type SharedTab = "all" | "share_link" | "team" | "manager";

interface SharedWithMePaneProps {
  activeTab: SharedTab;
  onTabChange: (tab: SharedTab) => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  counts: {
    all: number;
    share_link: number;
    team: number;
    manager: number;
  };
}

export function SharedWithMePane({
  activeTab,
  onTabChange,
  searchQuery,
  onSearchChange,
  counts,
}: SharedWithMePaneProps) {
  const filters: Array<{ id: SharedTab; label: string; icon: ComponentType<{ className?: string }>; count: number }> = [
    { id: "all", label: "All Calls", icon: RiFilter3Line, count: counts.all },
    { id: "share_link", label: "Direct Links", icon: RiLinksLine, count: counts.share_link },
    { id: "team", label: "Team Shares", icon: RiGroupLine, count: counts.team },
    { id: "manager", label: "Direct Reports", icon: RiGroupLine, count: counts.manager },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <header className="px-4 py-3 border-b border-border bg-card/50">
        <h2 className="text-sm font-bold text-ink uppercase tracking-wide">Sources</h2>
        <p className="text-xs text-ink-muted mt-0.5">Filter how calls were shared</p>
      </header>

      <div className="p-3 border-b border-border">
        <div className="relative">
          <RiSearchLine className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search calls..."
            className="h-9 pl-8 text-sm"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto p-2 space-y-1">
        {filters.map((filter) => {
          const Icon = filter.icon;
          const isActive = activeTab === filter.id;
          return (
            <button
              key={filter.id}
              type="button"
              onClick={() => onTabChange(filter.id)}
              className={cn(
                "w-full flex items-center justify-between rounded-lg px-3 py-2.5 text-left transition-colors",
                isActive ? "bg-hover border border-border" : "hover:bg-hover/70 border border-transparent"
              )}
            >
              <span className="flex items-center gap-2 min-w-0">
                <Icon className={cn("h-4 w-4", isActive ? "text-vibe-orange" : "text-muted-foreground")} />
                <span className={cn("text-sm truncate", isActive ? "text-foreground font-medium" : "text-muted-foreground")}>{filter.label}</span>
              </span>
              <Badge variant="secondary" className="text-xs">{filter.count}</Badge>
            </button>
          );
        })}
      </div>
    </div>
  );
}
