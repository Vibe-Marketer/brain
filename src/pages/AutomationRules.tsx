import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  RiSearchLine,
  RiAddLine,
  RiEyeLine,
  RiFlowChart,
  RiPlayCircleLine,
  RiTimeLine,
  RiCalendarLine,
  RiChatVoiceLine,
  RiEmotionLine,
  RiWebhookLine,
  RiArrowUpDownLine,
  RiMore2Fill,
  RiEditLine,
  RiDeleteBinLine,
  RiHistoryLine,
} from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { Spinner } from "@/components/ui/spinner";
import { AutomationRulesPane, type AutomationFilter } from "@/components/panes/AutomationRulesPane";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";
import { useTableSort } from "@/hooks/useTableSort";
import { usePanelStore } from "@/stores/panelStore";
import type { Database, Json } from "@/integrations/supabase/types";

// ============================================================================
// Types
// ============================================================================

// Use Supabase-generated type directly
type AutomationRule = Database['public']['Tables']['automation_rules']['Row'];

// Keep TriggerType for UI display purposes, but it's just a type guard
type TriggerType =
  | "call_created"
  | "transcript_phrase"
  | "sentiment"
  | "duration"
  | "webhook"
  | "scheduled";

// Type guard for trigger_type since DB stores as string
function isTriggerType(value: string): value is TriggerType {
  return ["call_created", "transcript_phrase", "sentiment", "duration", "webhook", "scheduled"].includes(value);
}

// ============================================================================
// Helper Functions
// ============================================================================

const getTriggerIcon = (triggerType: string) => {
  switch (triggerType) {
    case "call_created":
      return RiPlayCircleLine;
    case "transcript_phrase":
      return RiChatVoiceLine;
    case "sentiment":
      return RiEmotionLine;
    case "duration":
      return RiTimeLine;
    case "webhook":
      return RiWebhookLine;
    case "scheduled":
      return RiCalendarLine;
    default:
      return RiFlowChart;
  }
};

const getTriggerLabel = (triggerType: string): string => {
  switch (triggerType) {
    case "call_created":
      return "Call Created";
    case "transcript_phrase":
      return "Phrase Match";
    case "sentiment":
      return "Sentiment";
    case "duration":
      return "Duration";
    case "webhook":
      return "Webhook";
    case "scheduled":
      return "Scheduled";
    default:
      return "Unknown";
  }
};

const getTriggerColor = (triggerType: string): string => {
  switch (triggerType) {
    case "call_created":
      return "bg-success-bg text-success-text";
    case "transcript_phrase":
      return "bg-info-bg text-info-text";
    case "sentiment":
      return "bg-neutral-bg text-neutral-text";
    case "duration":
      return "bg-warning-bg text-warning-text";
    case "webhook":
      return "bg-info-bg text-info-text";
    case "scheduled":
      return "bg-info-bg text-info-text";
    default:
      return "bg-muted text-muted-foreground";
  }
};

const formatDate = (dateString: string | null) => {
  if (!dateString) return "Never";
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const formatDateTime = (dateString: string | null) => {
  if (!dateString) return "Never";
  const date = new Date(dateString);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

// ============================================================================
// Custom Hook: useAutomationRules
// ============================================================================

interface UseAutomationRulesResult {
  rules: AutomationRule[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  toggleRule: (ruleId: string, enabled: boolean) => Promise<void>;
  deleteRule: (ruleId: string) => Promise<void>;
}

function useAutomationRules(userId: string | undefined): UseAutomationRulesResult {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchRules = useCallback(async () => {
    if (!userId) {
      setRules([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("automation_rules")
        .select("*")
        .eq("user_id", userId)
        .order("priority", { ascending: true })
        .order("created_at", { ascending: false });

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      setRules((data as AutomationRule[]) || []);
    } catch (err) {
      logger.error("Error fetching automation rules", err);
      setError(err instanceof Error ? err : new Error("Failed to fetch rules"));
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  const toggleRule = useCallback(async (ruleId: string, enabled: boolean) => {
    try {
      const { error: updateError } = await supabase
        .from("automation_rules")
        .update({ enabled, updated_at: new Date().toISOString() })
        .eq("id", ruleId);

      if (updateError) {
        throw new Error(updateError.message);
      }

      setRules((prev) =>
        prev.map((rule) =>
          rule.id === ruleId ? { ...rule, enabled } : rule
        )
      );

      toast.success(enabled ? "Rule enabled" : "Rule disabled");
    } catch (err) {
      logger.error("Error toggling rule", err);
      toast.error("Failed to update rule");
    }
  }, []);

  const deleteRule = useCallback(async (ruleId: string) => {
    try {
      const { error: deleteError } = await supabase
        .from("automation_rules")
        .delete()
        .eq("id", ruleId);

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      setRules((prev) => prev.filter((rule) => rule.id !== ruleId));
      toast.success("Rule deleted");
    } catch (err) {
      logger.error("Error deleting rule", err);
      toast.error("Failed to delete rule");
    }
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  return {
    rules,
    isLoading,
    error,
    refetch: fetchRules,
    toggleRule,
    deleteRule,
  };
}

// ============================================================================
// Table Component
// ============================================================================

interface RulesTableProps {
  rules: AutomationRule[];
  onRowClick: (rule: AutomationRule) => void;
  onToggle: (ruleId: string, enabled: boolean) => void;
  onEdit: (rule: AutomationRule) => void;
  onDelete: (rule: AutomationRule) => void;
  onViewHistory: (rule: AutomationRule) => void;
}

function RulesTable({
  rules,
  onRowClick,
  onToggle,
  onEdit,
  onDelete,
  onViewHistory,
}: RulesTableProps) {
  const { sortField, sortDirection, sortedData, handleSort } = useTableSort(
    rules,
    "priority"
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

  if (rules.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <RiFlowChart className="h-12 w-12 mb-4 opacity-50" />
        <p className="text-sm">No automation rules found</p>
        <p className="text-xs mt-1 opacity-70">
          Create your first rule to automate workflows
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-3 px-4 w-12">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Active
              </span>
            </th>
            <th className="text-left py-3 px-4">
              <SortButton field="name">Name</SortButton>
            </th>
            <th className="text-left py-3 px-4">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Trigger
              </span>
            </th>
            <th className="text-left py-3 px-4">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Actions
              </span>
            </th>
            <th className="text-left py-3 px-4">
              <SortButton field="times_applied">Runs</SortButton>
            </th>
            <th className="text-left py-3 px-4">
              <SortButton field="last_applied_at">Last Run</SortButton>
            </th>
            <th className="text-right py-3 px-4 w-12">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedData.map((rule) => {
            const TriggerIcon = getTriggerIcon(rule.trigger_type);
            const actionCount = Array.isArray(rule.actions) ? rule.actions.length : 0;

            return (
              <tr
                key={rule.id}
                className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                onClick={() => onRowClick(rule)}
              >
                <td className="py-3 px-4">
                  <div onClick={(event) => event.stopPropagation()}>
                    <Switch
                      checked={rule.enabled}
                      onCheckedChange={(checked) => onToggle(rule.id, checked)}
                      aria-label={`${rule.enabled ? "Disable" : "Enable"} ${rule.name}`}
                    />
                  </div>
                </td>
                <td className="py-3 px-4">
                  <div className="flex flex-col">
                    <p className="text-sm font-medium text-foreground">
                      {rule.name}
                    </p>
                    {rule.description && (
                      <p className="text-xs text-muted-foreground truncate max-w-[300px]">
                        {rule.description}
                      </p>
                    )}
                  </div>
                </td>
                <td className="py-3 px-4">
                  <Badge
                    variant="secondary"
                    className={cn(
                      "text-xs font-normal gap-1.5",
                      getTriggerColor(rule.trigger_type)
                    )}
                  >
                    <TriggerIcon className="h-3.5 w-3.5" />
                    {getTriggerLabel(rule.trigger_type)}
                  </Badge>
                </td>
                <td className="py-3 px-4">
                  <span className="text-sm text-muted-foreground">
                    {actionCount} action{actionCount !== 1 ? "s" : ""}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <span className="text-sm text-muted-foreground">
                    {rule.times_applied.toLocaleString()}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <div className="flex flex-col">
                    <span className="text-sm text-muted-foreground">
                      {formatDateTime(rule.last_applied_at)}
                    </span>
                    {rule.trigger_type === "scheduled" && rule.next_run_at && (
                      <span className="text-xs text-muted-foreground/70">
                        Next: {formatDateTime(rule.next_run_at)}
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-3 px-4 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <RiMore2Fill className="h-4 w-4" />
                        <span className="sr-only">Actions for {rule.name}</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={(event) => {
                          event.stopPropagation();
                          onRowClick(rule);
                        }}
                      >
                        <RiEyeLine className="h-4 w-4 mr-2" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onEdit(rule)}>
                        <RiEditLine className="h-4 w-4 mr-2" />
                        Edit Rule
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onViewHistory(rule)}>
                        <RiHistoryLine className="h-4 w-4 mr-2" />
                        View History
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onDelete(rule)}
                        className="text-destructive focus:text-destructive"
                      >
                        <RiDeleteBinLine className="h-4 w-4 mr-2" />
                        Delete Rule
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
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

export default function AutomationRules() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { openPanel } = usePanelStore();

  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<AutomationFilter>("all");
  const [ruleToDelete, setRuleToDelete] = useState<AutomationRule | null>(null);

  // Fetch rules
  const { rules, isLoading, toggleRule, deleteRule } = useAutomationRules(user?.id);

  // Filter by search query
  const filteredRules = useMemo(() => {
    const filterByState = (candidate: AutomationRule) => {
      if (activeFilter === "active") return candidate.enabled;
      if (activeFilter === "inactive") return !candidate.enabled;
      return true;
    };

    const stateFiltered = rules.filter(filterByState);

    if (!searchQuery.trim()) return stateFiltered;
    const query = searchQuery.toLowerCase();
    return stateFiltered.filter(
      (rule) =>
        rule.name.toLowerCase().includes(query) ||
        (rule.description?.toLowerCase().includes(query) ?? false) ||
        getTriggerLabel(rule.trigger_type).toLowerCase().includes(query)
    );
  }, [rules, searchQuery, activeFilter]);

  // Stats
  const stats = useMemo(() => {
    const active = rules.filter((r) => r.enabled).length;
    const totalRuns = rules.reduce((sum, r) => sum + r.times_applied, 0);
    return { total: rules.length, active, totalRuns };
  }, [rules]);

  // Handlers
  const handleCreateRule = () => {
    navigate("/automation-rules/new");
  };

  const handleEditRule = (rule: AutomationRule) => {
    navigate(`/automation-rules/${rule.id}`);
  };

  const handleViewHistory = (rule: AutomationRule) => {
    navigate(`/automation-rules/${rule.id}/history`);
  };

  const handleRuleRowClick = (rule: AutomationRule) => {
    openPanel("automation-rule", { type: "automation-rule", ruleId: rule.id });
  };

  const handleDeleteConfirm = async () => {
    if (ruleToDelete) {
      await deleteRule(ruleToDelete.id);
      setRuleToDelete(null);
    }
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
        <RiFlowChart className="h-16 w-16 text-muted-foreground opacity-50" />
        <p className="text-muted-foreground">Please sign in to view automation rules</p>
        <Button onClick={() => navigate("/login")}>SIGN IN</Button>
      </div>
    );
  }

  return (
    <AppShell
      config={{
        secondaryPane: (
          <AutomationRulesPane
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
            stats={stats}
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
              <RiFlowChart className="h-4 w-4 text-vibe-orange" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-ink uppercase tracking-wide">
                AUTOMATION RULES
              </h2>
              <p className="text-xs text-ink-muted">
                {stats.total} rule{stats.total !== 1 ? "s" : ""}
                {stats.active > 0 && ` (${stats.active} active)`}
                {stats.totalRuns > 0 && ` \u2022 ${stats.totalRuns.toLocaleString()} total runs`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="relative w-64 hidden md:block">
              <RiSearchLine className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search rules..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 pl-8 text-sm"
              />
            </div>
            <Button onClick={handleCreateRule} className="gap-2">
              <RiAddLine className="h-4 w-4" />
              <span className="hidden sm:inline">New Rule</span>
            </Button>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Spinner size="lg" />
            </div>
          ) : rules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <RiFlowChart className="h-16 w-16 text-muted-foreground opacity-50" />
              <div className="text-center">
                <h2 className="text-lg font-semibold mb-1">No automation rules yet</h2>
                <p className="text-sm text-muted-foreground max-w-md">
                  Create automation rules to automatically organize calls, send notifications,
                  run AI analysis, and more based on triggers like sentiment, duration, or keywords.
                </p>
              </div>
              <Button onClick={handleCreateRule} className="gap-2 mt-2">
                <RiAddLine className="h-4 w-4" />
                Create Your First Rule
              </Button>

              <div className="flex flex-wrap justify-center gap-2 mt-6 max-w-lg">
                <Badge variant="secondary" className={cn("text-xs", getTriggerColor("call_created"))}>
                  <RiPlayCircleLine className="h-3 w-3 mr-1" />
                  Call Created
                </Badge>
                <Badge variant="secondary" className={cn("text-xs", getTriggerColor("transcript_phrase"))}>
                  <RiChatVoiceLine className="h-3 w-3 mr-1" />
                  Phrase Match
                </Badge>
                <Badge variant="secondary" className={cn("text-xs", getTriggerColor("sentiment"))}>
                  <RiEmotionLine className="h-3 w-3 mr-1" />
                  Sentiment
                </Badge>
                <Badge variant="secondary" className={cn("text-xs", getTriggerColor("duration"))}>
                  <RiTimeLine className="h-3 w-3 mr-1" />
                  Duration
                </Badge>
                <Badge variant="secondary" className={cn("text-xs", getTriggerColor("webhook"))}>
                  <RiWebhookLine className="h-3 w-3 mr-1" />
                  Webhook
                </Badge>
                <Badge variant="secondary" className={cn("text-xs", getTriggerColor("scheduled"))}>
                  <RiCalendarLine className="h-3 w-3 mr-1" />
                  Scheduled
                </Badge>
              </div>
            </div>
          ) : (
            <RulesTable
              rules={filteredRules}
              onRowClick={handleRuleRowClick}
              onToggle={toggleRule}
              onEdit={handleEditRule}
              onDelete={setRuleToDelete}
              onViewHistory={handleViewHistory}
            />
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!ruleToDelete} onOpenChange={() => setRuleToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Rule</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{ruleToDelete?.name}&quot;?
              This action cannot be undone. The rule&apos;s execution history will also be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
