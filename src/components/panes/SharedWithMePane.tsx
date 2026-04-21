import { RiFilter3Line, RiGroupLine, RiLinksLine, RiSearchLine, RiShareLine } from "@remixicon/react";
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
    { id: "all", label: "All", icon: RiFilter3Line, count: counts.all },
    { id: "share_link", label: "Direct Links", icon: RiLinksLine, count: counts.share_link },
    { id: "team", label: "Team Shares", icon: RiGroupLine, count: counts.team },
    { id: "manager", label: "Direct Reports", icon: RiGroupLine, count: counts.manager },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <header className="px-4 py-4 border-b border-border flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-cb-border/40 flex items-center justify-center">
              <RiShareLine className="h-4.5 w-4.5 text-vibe-orange" />
            </div>
            <div>
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground leading-none">Shared</h2>
              <p className="text-[9px] text-muted-foreground/60 uppercase">Shared With Me</p>
            </div>
          </div>
        </div>
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
                isActive ? "bg-muted border border-border" : "hover:bg-muted/70 border border-transparent"
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

      <footer className="shrink-0 px-4 py-3 border-t border-border" />
    </div>
  );
}
