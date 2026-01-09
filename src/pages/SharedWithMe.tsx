import { useState, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  RiSearchLine,
  RiCalendarLine,
  RiTimeLine,
  RiLoader2Line,
  RiLinksLine,
  RiUserHeartLine,
  RiGroupLine,
  RiFileTextLine,
  RiArrowUpDownLine,
  RiShareLine,
} from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useSharedCalls } from "@/hooks/useCoachRelationships";
import { useDirectReports, useTeamShares } from "@/hooks/useTeamHierarchy";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/query-config";
import { logger } from "@/lib/logger";
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
  source_type: "share_link" | "coach" | "team" | "manager";
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
    case "coach":
      return RiUserHeartLine;
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
      return "bg-blue-500/10 text-blue-500";
    case "coach":
      return "bg-purple-500/10 text-purple-500";
    case "team":
      return "bg-green-500/10 text-green-500";
    case "manager":
      return "bg-orange-500/10 text-orange-500";
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

  // Get calls shared via share links
  const { data: shareLinkCalls, isLoading: isLoadingShareLinks } = useQuery({
    queryKey: queryKeys.sharing.sharedWithMe(),
    queryFn: async () => {
      if (!userId) return [];

      // Get all share links where user has accessed
      const { data: accessLogs, error: logsError } = await supabase
        .from("call_share_access_log")
        .select(`
          share_link_id,
          call_share_links!inner(
            id,
            call_recording_id,
            user_id,
            status
          )
        `)
        .eq("accessed_by_user_id", userId);

      if (logsError) {
        logger.error("Error fetching share link access", logsError);
        return [];
      }

      // Also get active share links where user is the recipient (by email)
      const { data: userData } = await supabase.rpc("get_user_email", {
        user_id: userId,
      });

      const { data: recipientLinks, error: recipientError } = await supabase
        .from("call_share_links")
        .select("*")
        .eq("recipient_email", userData)
        .eq("status", "active");

      if (recipientError) {
        logger.error("Error fetching recipient share links", recipientError);
      }

      // Combine and dedupe
      const linkIds = new Set<string>();
      const allLinks: Array<{
        share_link_id: string;
        call_recording_id: number;
        user_id: string;
      }> = [];

      // From access logs
      accessLogs?.forEach((log) => {
        const link = log.call_share_links as unknown as {
          id: string;
          call_recording_id: number;
          user_id: string;
          status: string;
        };
        if (link.status === "active" && !linkIds.has(link.id)) {
          linkIds.add(link.id);
          allLinks.push({
            share_link_id: link.id,
            call_recording_id: link.call_recording_id,
            user_id: link.user_id,
          });
        }
      });

      // From recipient links
      recipientLinks?.forEach((link) => {
        if (!linkIds.has(link.id)) {
          linkIds.add(link.id);
          allLinks.push({
            share_link_id: link.id,
            call_recording_id: link.call_recording_id,
            user_id: link.user_id,
          });
        }
      });

      if (allLinks.length === 0) return [];

      // Fetch call details
      const calls: SharedCallBase[] = [];
      for (const link of allLinks) {
        const { data: call } = await supabase
          .from("fathom_calls")
          .select("recording_id, call_name, recording_start_time, duration")
          .eq("recording_id", link.call_recording_id)
          .eq("user_id", link.user_id)
          .single();

        if (call) {
          const { data: ownerEmail } = await supabase.rpc("get_user_email", {
            user_id: link.user_id,
          });

          calls.push({
            ...call,
            owner_email: ownerEmail || "Unknown",
            source_type: "share_link",
            source_label: "Direct Link",
          });
        }
      }

      return calls;
    },
    enabled: enabled && !!userId,
  });

  // Get calls shared via coach relationships (where user is coach)
  const { sharedCalls: coachCalls, isLoading: isLoadingCoachCalls } = useSharedCalls({
    userId,
    enabled: enabled && !!userId,
  });

  // Get calls from direct reports (where user is manager)
  const { directReportCalls, isLoading: isLoadingManagerCalls } = useDirectReports({
    userId,
    enabled: enabled && !!userId,
  });

  // Get calls shared via team shares
  const { sharesWithMe, isLoading: isLoadingTeamShares } = useTeamShares({
    userId,
    enabled: enabled && !!userId,
  });

  // Get team-shared calls
  const { data: teamSharedCalls, isLoading: isLoadingTeamCalls } = useQuery({
    queryKey: ["shared-with-me", "team-calls", userId],
    queryFn: async () => {
      if (!userId || !sharesWithMe?.length) return [];

      const calls: SharedCallBase[] = [];
      const seenCallIds = new Set<number>();

      for (const share of sharesWithMe) {
        // For each share rule, fetch matching calls
        let query = supabase
          .from("fathom_calls")
          .select("recording_id, call_name, recording_start_time, duration, user_id")
          .eq("user_id", share.owner_user_id)
          .order("recording_start_time", { ascending: false })
          .limit(50);

        if (share.share_type === "folder" && share.folder_id) {
          // Get calls in this folder
          const { data: folderAssignments } = await supabase
            .from("folder_assignments")
            .select("recording_id")
            .eq("folder_id", share.folder_id);

          if (folderAssignments?.length) {
            const recordingIds = folderAssignments.map((a) => a.recording_id);
            query = query.in("recording_id", recordingIds);
          } else {
            continue; // No calls in folder
          }
        } else if (share.share_type === "tag" && share.tag_id) {
          // Get calls with this tag
          const { data: tagAssignments } = await supabase
            .from("call_tag_assignments")
            .select("recording_id")
            .eq("tag_id", share.tag_id);

          if (tagAssignments?.length) {
            const recordingIds = tagAssignments.map((a) => a.recording_id);
            query = query.in("recording_id", recordingIds);
          } else {
            continue; // No calls with tag
          }
        }

        const { data: shareCalls, error } = await query;

        if (error) {
          logger.error("Error fetching team shared calls", error);
          continue;
        }

        for (const call of shareCalls || []) {
          if (!seenCallIds.has(call.recording_id)) {
            seenCallIds.add(call.recording_id);
            calls.push({
              recording_id: call.recording_id,
              call_name: call.call_name,
              recording_start_time: call.recording_start_time,
              duration: call.duration,
              owner_email: share.owner_name || "Teammate",
              source_type: "team",
              source_label: share.folder_name || share.tag_name || "Team Share",
            });
          }
        }
      }

      return calls;
    },
    enabled: enabled && !!userId && sharesWithMe && sharesWithMe.length > 0,
  });

  // Transform coach calls
  const transformedCoachCalls: SharedCallBase[] = useMemo(() => {
    return (coachCalls || []).map((call) => ({
      recording_id: call.recording_id,
      call_name: call.call_name,
      recording_start_time: call.recording_start_time,
      duration: call.duration,
      owner_email: call.coachee_email,
      owner_name: call.coachee_name,
      source_type: "coach" as const,
      source_label: "Coaching",
    }));
  }, [coachCalls]);

  // Transform manager calls
  const transformedManagerCalls: SharedCallBase[] = useMemo(() => {
    return (directReportCalls || []).map((call) => ({
      recording_id: call.recording_id,
      call_name: call.call_name,
      recording_start_time: call.recording_start_time,
      duration: call.duration,
      owner_email: call.owner_email,
      owner_name: call.owner_name,
      source_type: "manager" as const,
      source_label: "Direct Report",
    }));
  }, [directReportCalls]);

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
    addCalls(transformedCoachCalls);
    addCalls(transformedManagerCalls);
    addCalls(teamSharedCalls || []);

    // Sort by date descending
    return combined.sort(
      (a, b) =>
        new Date(b.recording_start_time).getTime() -
        new Date(a.recording_start_time).getTime()
    );
  }, [
    shareLinkCalls,
    transformedCoachCalls,
    transformedManagerCalls,
    teamSharedCalls,
  ]);

  const isLoading =
    isLoadingShareLinks ||
    isLoadingCoachCalls ||
    isLoadingManagerCalls ||
    isLoadingTeamShares ||
    isLoadingTeamCalls;

  // Group by source type for tabs
  const bySourceType = useMemo(() => {
    return {
      all: allCalls,
      share_link: allCalls.filter((c) => c.source_type === "share_link"),
      coach: allCalls.filter((c) => c.source_type === "coach"),
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
      coach: bySourceType.coach.length,
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
  showSourceColumn?: boolean;
}

function SharedCallsTable({
  calls,
  onCallClick,
  showSourceColumn = true,
}: SharedCallsTableProps) {
  const { sortField, sortDirection, sortedData, handleSort } = useTableSort(
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

  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<string>("all");

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
    navigate(`/call/${call.recording_id}`);
  };

  // Loading state
  if (authLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <RiLoader2Line className="h-8 w-8 animate-spin text-muted-foreground" />
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

  // Empty state
  if (!isLoading && counts.all === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 p-8">
        <RiShareLine className="h-16 w-16 text-muted-foreground opacity-50" />
        <h1 className="text-xl font-bold">Shared With Me</h1>
        <p className="text-muted-foreground text-center max-w-md">
          No calls have been shared with you yet. When colleagues share calls via
          links, coaching relationships, or team sharing, they&apos;ll appear here.
        </p>
        <div className="flex flex-col gap-2 text-sm text-muted-foreground mt-4">
          <div className="flex items-center gap-2">
            <RiLinksLine className="h-4 w-4 text-blue-500" />
            <span>Direct share links</span>
          </div>
          <div className="flex items-center gap-2">
            <RiUserHeartLine className="h-4 w-4 text-purple-500" />
            <span>Coaching relationships</span>
          </div>
          <div className="flex items-center gap-2">
            <RiGroupLine className="h-4 w-4 text-green-500" />
            <span>Team folder/tag sharing</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Main Content Card */}
      <div className="flex-1 min-h-0 bg-card rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col m-1">
        {/* Header */}
        <div className="px-4 md:px-10 pt-4 flex-shrink-0 border-b border-border">
          <div className="flex items-center gap-2 mb-4">
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              SHARING
            </p>
          </div>
          <div className="flex items-end justify-between gap-4 mb-4">
            <div className="flex-1 min-w-0">
              <h1 className="font-display text-2xl md:text-4xl font-extrabold text-foreground uppercase tracking-wide mb-0.5">
                SHARED WITH ME
              </h1>
              <p className="text-sm text-muted-foreground">
                {counts.all} call{counts.all !== 1 ? "s" : ""} shared with you
              </p>
            </div>
            {/* Search */}
            <div className="relative w-64 flex-shrink-0 hidden md:block">
              <RiSearchLine className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search shared calls..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 pl-8 text-sm"
              />
            </div>
          </div>

          {/* Source Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="h-auto p-0 bg-transparent border-b-0 gap-0">
              <TabsTrigger
                value="all"
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2"
              >
                All
                <Badge variant="secondary" className="ml-2 text-xs">
                  {counts.all}
                </Badge>
              </TabsTrigger>
              {counts.share_link > 0 && (
                <TabsTrigger
                  value="share_link"
                  className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2"
                >
                  <RiLinksLine className="h-4 w-4 mr-1.5" />
                  Links
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {counts.share_link}
                  </Badge>
                </TabsTrigger>
              )}
              {counts.coach > 0 && (
                <TabsTrigger
                  value="coach"
                  className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2"
                >
                  <RiUserHeartLine className="h-4 w-4 mr-1.5" />
                  Coaching
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {counts.coach}
                  </Badge>
                </TabsTrigger>
              )}
              {counts.team > 0 && (
                <TabsTrigger
                  value="team"
                  className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2"
                >
                  <RiGroupLine className="h-4 w-4 mr-1.5" />
                  Team
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {counts.team}
                  </Badge>
                </TabsTrigger>
              )}
              {counts.manager > 0 && (
                <TabsTrigger
                  value="manager"
                  className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2"
                >
                  <RiGroupLine className="h-4 w-4 mr-1.5" />
                  Direct Reports
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {counts.manager}
                  </Badge>
                </TabsTrigger>
              )}
            </TabsList>
          </Tabs>
        </div>

        {/* Calls Table */}
        <div className="flex-1 overflow-auto p-4 md:p-10">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <RiLoader2Line className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <SharedCallsTable
              calls={filteredCalls}
              onCallClick={handleCallClick}
              showSourceColumn={activeTab === "all"}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default SharedWithMe;
