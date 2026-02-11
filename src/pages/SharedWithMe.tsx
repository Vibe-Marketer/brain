import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  RiCalendarLine,
  RiTimeLine,
  RiLinksLine,
  RiGroupLine,
  RiFileTextLine,
  RiArrowUpDownLine,
  RiShareLine,
} from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { Spinner } from "@/components/ui/spinner";
import { SharedWithMePane } from "@/components/panes/SharedWithMePane";
import { usePanelStore } from "@/stores/panelStore";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/query-config";
import { useTableSort } from "@/hooks/useTableSort";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

interface SharedCallBase {
  recording_id: number;
  call_name: string;
  recording_start_time: string;
  duration: string | null;
  owner_email: string;
  owner_name?: string | null;
  source_type: "share_link" | "team" | "manager";
  source_label: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const formatTime = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
};

const formatDuration = (duration: string | null) => {
  if (!duration) return "-";
  // Duration might be in ISO 8601 format or HH:MM:SS
  if (duration.includes("T")) {
    // Parse ISO 8601 duration (e.g., PT1H30M)
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (match) {
      const hours = parseInt(match[1] || "0");
      const minutes = parseInt(match[2] || "0");
      if (hours > 0) return `${hours}h ${minutes}m`;
      return `${minutes}m`;
    }
  }
  // Try HH:MM:SS format
  const parts = duration.split(":");
  if (parts.length === 3) {
    const hours = parseInt(parts[0]);
    const minutes = parseInt(parts[1]);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }
  return duration;
};

const getSourceIcon = (sourceType: SharedCallBase["source_type"]) => {
  switch (sourceType) {
    case "share_link":
      return RiLinksLine;
    case "team":
      return RiGroupLine;
    case "manager":
      return RiGroupLine;
    default:
      return RiShareLine;
  }
};

const getSourceColor = (sourceType: SharedCallBase["source_type"]) => {
  switch (sourceType) {
    case "share_link":
      return "bg-info-bg text-info-text";
    case "team":
      return "bg-success-bg text-success-text";
    case "manager":
      return "bg-warning-bg text-warning-text";
    default:
      return "bg-muted text-muted-foreground";
  }
};

// ============================================================================
// Custom Hook: useSharedWithMe
// ============================================================================

interface UseSharedWithMeOptions {
  userId?: string;
  enabled?: boolean;
}

function useSharedWithMe(options: UseSharedWithMeOptions) {
  const { userId, enabled = true } = options;

  const { data: shareLinkCalls, isLoading: isLoadingShareLinks } = useQuery({
    queryKey: queryKeys.sharing.sharedWithMe(),
    queryFn: async () => {
      // Preferred path: RPC backed by SECURITY DEFINER function
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rpcResult = await (supabase as any).rpc("get_calls_shared_with_me_v2", {
        p_include_expired: false,
      });

      if (rpcResult.error) {
        return [] as SharedCallBase[];
      }

      const rows = rpcResult.data;

      return ((rows || []) as Array<{
        recording_id: number;
        call_name: string;
        recording_start_time: string;
        duration: string | null;
        source_label: string;
      }>).map((row) => ({
        recording_id: row.recording_id,
        call_name: row.call_name,
        recording_start_time: row.recording_start_time,
        duration: row.duration,
        owner_email: "Shared via link",
        source_type: "share_link" as const,
        source_label: row.source_label || "Direct Link",
      }));
    },
    enabled: enabled && !!userId,
  });

  // Combine all calls and dedupe
  const allCalls = useMemo(() => {
    const combined: SharedCallBase[] = [];
    const seenIds = new Set<number>();

    const addCalls = (calls: SharedCallBase[]) => {
      for (const call of calls) {
        if (!seenIds.has(call.recording_id)) {
          seenIds.add(call.recording_id);
          combined.push(call);
        }
      }
    };

    addCalls(shareLinkCalls || []);

    // Sort by date descending
    return combined.sort(
      (a, b) =>
        new Date(b.recording_start_time).getTime() -
        new Date(a.recording_start_time).getTime()
    );
  }, [
    shareLinkCalls,
  ]);

  const isLoading = isLoadingShareLinks;

  // Group by source type for tabs
  const bySourceType = useMemo(() => {
    return {
      all: allCalls,
      share_link: allCalls.filter((c) => c.source_type === "share_link"),
      team: allCalls.filter((c) => c.source_type === "team"),
      manager: allCalls.filter((c) => c.source_type === "manager"),
    };
  }, [allCalls]);

  return {
    allCalls,
    bySourceType,
    isLoading,
    counts: {
      all: allCalls.length,
      share_link: bySourceType.share_link.length,
      team: bySourceType.team.length,
      manager: bySourceType.manager.length,
    },
  };
}

// ============================================================================
// Table Component
// ============================================================================

interface SharedCallsTableProps {
  calls: SharedCallBase[];
  onCallClick: (call: SharedCallBase) => void;
  onOpenCallPage: (call: SharedCallBase) => void;
  showSourceColumn?: boolean;
}

function SharedCallsTable({
  calls,
  onCallClick,
  onOpenCallPage,
  showSourceColumn = true,
}: SharedCallsTableProps) {
  const { sortField, sortedData, handleSort } = useTableSort(
    calls,
    "recording_start_time"
  );

  const SortButton = ({
    field,
    children,
  }: {
    field: string;
    children: React.ReactNode;
  }) => (
    <button
      onClick={() => handleSort(field)}
      className="h-8 px-2 inline-flex items-center justify-center gap-2 hover:bg-muted/50 font-medium text-xs rounded-md transition-colors cursor-pointer uppercase tracking-wide"
    >
      {children}
      <RiArrowUpDownLine
        className={cn(
          "ml-1 h-3.5 w-3.5",
          sortField === field ? "text-foreground" : "text-muted-foreground"
        )}
      />
    </button>
  );

  if (calls.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <RiFileTextLine className="h-12 w-12 mb-4 opacity-50" />
        <p className="text-sm">No shared calls found</p>
        <p className="text-xs mt-1 opacity-70">
          Calls shared with you will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-3 px-4">
              <SortButton field="call_name">Title</SortButton>
            </th>
            <th className="text-left py-3 px-4">
              <SortButton field="owner_email">Shared By</SortButton>
            </th>
            {showSourceColumn && (
              <th className="text-left py-3 px-4">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Source
                </span>
              </th>
            )}
            <th className="text-left py-3 px-4">
              <SortButton field="recording_start_time">Date</SortButton>
            </th>
            <th className="text-left py-3 px-4">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Duration
              </span>
            </th>
            <th className="text-right py-3 px-4">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Open</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedData.map((call) => {
            const SourceIcon = getSourceIcon(call.source_type);
            return (
              <tr
                key={`${call.source_type}-${call.recording_id}`}
                className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer"
                onClick={() => onCallClick(call)}
              >
                <td className="py-3 px-4">
                  <p className="text-sm font-medium text-foreground truncate max-w-[300px]">
                    {call.call_name}
                  </p>
                </td>
                <td className="py-3 px-4">
                  <p className="text-sm text-muted-foreground">
                    {call.owner_name || call.owner_email.split("@")[0]}
                  </p>
                </td>
                {showSourceColumn && (
                  <td className="py-3 px-4">
                    <Badge
                      variant="secondary"
                      className={cn(
                        "text-xs font-normal gap-1",
                        getSourceColor(call.source_type)
                      )}
                    >
                      <SourceIcon className="h-3 w-3" />
                      {call.source_label}
                    </Badge>
                  </td>
                )}
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <RiCalendarLine className="h-4 w-4" />
                    <span>{formatDate(call.recording_start_time)}</span>
                    <span className="opacity-50">
                      {formatTime(call.recording_start_time)}
                    </span>
                  </div>
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <RiTimeLine className="h-4 w-4" />
                    <span>{formatDuration(call.duration)}</span>
                  </div>
                </td>
                <td className="py-3 px-4 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpenCallPage(call);
                    }}
                  >
                    Open
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

const SharedWithMe = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { openPanel } = usePanelStore();

  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "share_link" | "team" | "manager">("all");

  // Get shared calls
  const { bySourceType, isLoading, counts } = useSharedWithMe({
    userId: user?.id,
    enabled: !!user?.id,
  });

  // Filter by search query
  const filteredCalls = useMemo(() => {
    const sourceCalls = bySourceType[activeTab as keyof typeof bySourceType] || bySourceType.all;
    if (!searchQuery.trim()) return sourceCalls;
    const query = searchQuery.toLowerCase();
    return sourceCalls.filter(
      (call) =>
        call.call_name.toLowerCase().includes(query) ||
        call.owner_email.toLowerCase().includes(query) ||
        (call.owner_name?.toLowerCase().includes(query) ?? false) ||
        call.source_label.toLowerCase().includes(query)
    );
  }, [bySourceType, activeTab, searchQuery]);

  // Handle call click
  const handleCallClick = (call: SharedCallBase) => {
    openPanel("call-detail", {
      type: "call-detail",
      recordingId: call.recording_id,
      title: call.call_name,
    });
  };

  const handleOpenCallPage = (call: SharedCallBase) => {
    navigate(`/call/${call.recording_id}`);
  };

  // Loading state
  if (authLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4">
        <RiShareLine className="h-16 w-16 text-muted-foreground opacity-50" />
        <p className="text-muted-foreground">Please sign in to view shared calls</p>
        <Button onClick={() => navigate("/login")}>SIGN IN</Button>
      </div>
    );
  }

  return (
    <AppShell
      config={{
        secondaryPane: (
          <SharedWithMePane
            activeTab={activeTab}
            onTabChange={setActiveTab}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            counts={counts}
          />
        ),
        showDetailPane: true,
      }}
    >
      <div className="h-full flex flex-col overflow-hidden">
        <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-8 h-8 rounded-lg bg-vibe-orange/10 flex items-center justify-center flex-shrink-0"
              aria-hidden="true"
            >
              <RiShareLine className="h-4 w-4 text-vibe-orange" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-ink uppercase tracking-wide">
                SHARED WITH ME
              </h2>
              <p className="text-xs text-ink-muted">
                {counts.all} call{counts.all !== 1 ? "s" : ""} shared with you
              </p>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Spinner size="lg" />
            </div>
          ) : (
            <SharedCallsTable
              calls={filteredCalls}
              onCallClick={handleCallClick}
              onOpenCallPage={handleOpenCallPage}
              showSourceColumn={activeTab === "all"}
            />
          )}
        </div>
      </div>
    </AppShell>
  );
};

export default SharedWithMe;
