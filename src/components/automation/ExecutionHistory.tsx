import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  RiLoader2Line,
  RiArrowLeftLine,
  RiSearchLine,
  RiFilterLine,
  RiCheckLine,
  RiCloseLine,
  RiTimeLine,
  RiFlowChart,
  RiArrowDownSLine,
  RiArrowRightSLine,
  RiPlayCircleLine,
  RiChatVoiceLine,
  RiEmotionLine,
  RiWebhookLine,
  RiCalendarLine,
  RiRefreshLine,
  RiInformationLine,
  RiAlertLine,
  RiCheckboxCircleLine,
  RiCloseCircleLine,
  RiFileListLine,
  RiMailLine,
  RiFolderAddLine,
  RiPriceTag3Line,
  RiBookmarkLine,
  RiRobot2Line,
  RiHeartPulseLine,
} from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

type TriggerType =
  | "call_created"
  | "transcript_phrase"
  | "sentiment"
  | "duration"
  | "webhook"
  | "scheduled";

interface ConditionEvaluation {
  condition?: Record<string, unknown>;
  type?: string;
  field?: string;
  operator?: string;
  value?: unknown;
  result: boolean;
  reason?: string;
}

interface ActionExecution {
  action?: Record<string, unknown>;
  action_type?: string;
  config?: Record<string, unknown>;
  result: string;
  details?: Record<string, unknown>;
  error?: string;
}

interface TriggerResult {
  fires: boolean;
  reason?: string;
  match_details?: Record<string, unknown>;
}

interface CallSnapshot {
  recording_id?: number;
  title?: string;
  duration_minutes?: number;
  participant_count?: number;
  sentiment?: string;
  sentiment_confidence?: number;
  created_at?: string;
  has_transcript?: boolean;
  has_summary?: boolean;
  category?: Record<string, unknown>;
  tags?: string[];
}

interface ActionsSummary {
  total: number;
  succeeded: number;
  failed: number;
  skipped: number;
}

interface DebugInfo {
  rule_name?: string;
  trigger_result?: TriggerResult;
  conditions_evaluated?: ConditionEvaluation[];
  conditions_summary?: string;
  actions_executed?: ActionExecution[];
  actions_summary?: ActionsSummary;
  call_snapshot?: CallSnapshot;
  execution_metadata?: Record<string, unknown>;
}

interface ExecutionRecord {
  id: string;
  rule_id: string;
  user_id: string;
  trigger_type: TriggerType;
  trigger_source: Record<string, unknown> | null;
  triggered_at: string;
  completed_at: string | null;
  execution_time_ms: number | null;
  success: boolean;
  error_message: string | null;
  debug_info: DebugInfo;
  created_at: string;
}

interface AutomationRule {
  id: string;
  name: string;
  description: string | null;
  trigger_type: TriggerType;
}

type StatusFilter = "all" | "success" | "failure";

// ============================================================================
// Helper Functions
// ============================================================================

const getTriggerIcon = (triggerType: TriggerType) => {
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

const getTriggerLabel = (triggerType: TriggerType): string => {
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

const getTriggerColor = (triggerType: TriggerType): string => {
  switch (triggerType) {
    case "call_created":
      return "bg-green-500/10 text-green-600 dark:text-green-400";
    case "transcript_phrase":
      return "bg-blue-500/10 text-blue-600 dark:text-blue-400";
    case "sentiment":
      return "bg-purple-500/10 text-purple-600 dark:text-purple-400";
    case "duration":
      return "bg-orange-500/10 text-orange-600 dark:text-orange-400";
    case "webhook":
      return "bg-pink-500/10 text-pink-600 dark:text-pink-400";
    case "scheduled":
      return "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400";
    default:
      return "bg-muted text-muted-foreground";
  }
};

const getActionIcon = (actionType: string) => {
  switch (actionType) {
    case "email":
      return RiMailLine;
    case "add_to_folder":
    case "remove_from_folder":
      return RiFolderAddLine;
    case "add_tag":
    case "remove_tag":
      return RiPriceTag3Line;
    case "set_category":
      return RiBookmarkLine;
    case "run_ai_analysis":
      return RiRobot2Line;
    case "update_client_health":
      return RiHeartPulseLine;
    case "webhook":
      return RiWebhookLine;
    case "generate_digest":
      return RiFileListLine;
    default:
      return RiFlowChart;
  }
};

const formatDateTime = (dateString: string | null) => {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
};

const formatDuration = (ms: number | null): string => {
  if (ms === null) return "N/A";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
};

const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDateTime(dateString);
};

// ============================================================================
// Custom Hook: useExecutionHistory
// ============================================================================

interface UseExecutionHistoryResult {
  executions: ExecutionRecord[];
  rule: AutomationRule | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

function useExecutionHistory(
  ruleId: string | undefined,
  userId: string | undefined
): UseExecutionHistoryResult {
  const [executions, setExecutions] = useState<ExecutionRecord[]>([]);
  const [rule, setRule] = useState<AutomationRule | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!userId || !ruleId) {
      setExecutions([]);
      setRule(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Fetch rule details and execution history in parallel
      const [ruleRes, historyRes] = await Promise.all([
        supabase
          .from("automation_rules")
          .select("id, name, description, trigger_type")
          .eq("id", ruleId)
          .eq("user_id", userId)
          .single(),
        supabase
          .from("automation_execution_history")
          .select("*")
          .eq("rule_id", ruleId)
          .eq("user_id", userId)
          .order("triggered_at", { ascending: false })
          .limit(100),
      ]);

      if (ruleRes.error && ruleRes.error.code !== "PGRST116") {
        throw new Error(ruleRes.error.message);
      }

      if (historyRes.error) {
        throw new Error(historyRes.error.message);
      }

      setRule(ruleRes.data as AutomationRule | null);
      setExecutions((historyRes.data as ExecutionRecord[]) || []);
    } catch (err) {
      logger.error("Error fetching execution history", err);
      setError(err instanceof Error ? err : new Error("Failed to fetch data"));
    } finally {
      setIsLoading(false);
    }
  }, [ruleId, userId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    executions,
    rule,
    isLoading,
    error,
    refetch: fetchData,
  };
}

// ============================================================================
// Debug Panel Components
// ============================================================================

interface DebugSectionProps {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  defaultOpen?: boolean;
  children: React.ReactNode;
  badge?: React.ReactNode;
}

function DebugSection({
  title,
  icon: Icon,
  defaultOpen = false,
  children,
  badge,
}: DebugSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-muted/50 rounded-lg transition-colors group">
          {isOpen ? (
            <RiArrowDownSLine className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : (
            <RiArrowRightSLine className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
          <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium">{title}</span>
          {badge && <span className="ml-auto">{badge}</span>}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pl-9 pr-3 pb-2">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

interface TriggerResultPanelProps {
  triggerResult: TriggerResult | undefined;
  triggerType: TriggerType;
}

function TriggerResultPanel({
  triggerResult,
  triggerType,
}: TriggerResultPanelProps) {
  if (!triggerResult) {
    return (
      <p className="text-sm text-muted-foreground italic">
        No trigger result data available
      </p>
    );
  }

  const TriggerIcon = getTriggerIcon(triggerType);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Badge
          variant="secondary"
          className={cn("text-xs gap-1", getTriggerColor(triggerType))}
        >
          <TriggerIcon className="h-3 w-3" />
          {getTriggerLabel(triggerType)}
        </Badge>
        <Badge
          variant="secondary"
          className={cn(
            "text-xs",
            triggerResult.fires
              ? "bg-green-500/10 text-green-600 dark:text-green-400"
              : "bg-red-500/10 text-red-600 dark:text-red-400"
          )}
        >
          {triggerResult.fires ? "Fired" : "Did not fire"}
        </Badge>
      </div>
      {triggerResult.reason && (
        <p className="text-sm text-muted-foreground">{triggerResult.reason}</p>
      )}
      {triggerResult.match_details &&
        Object.keys(triggerResult.match_details).length > 0 && (
          <div className="bg-muted/50 rounded-lg p-2 mt-2">
            <p className="text-xs font-medium text-muted-foreground mb-1">
              Match Details
            </p>
            <pre className="text-xs font-mono overflow-auto max-h-32">
              {JSON.stringify(triggerResult.match_details, null, 2)}
            </pre>
          </div>
        )}
    </div>
  );
}

interface ConditionsEvaluatedPanelProps {
  conditions: ConditionEvaluation[] | undefined;
  summary: string | undefined;
}

function ConditionsEvaluatedPanel({
  conditions,
  summary,
}: ConditionsEvaluatedPanelProps) {
  if (!conditions || conditions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">
        No conditions were evaluated
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {summary && (
        <p className="text-sm text-muted-foreground">{summary}</p>
      )}
      <div className="space-y-2">
        {conditions.map((cond, index) => (
          <div
            key={index}
            className={cn(
              "flex items-start gap-2 p-2 rounded-lg border",
              cond.result
                ? "border-green-500/30 bg-green-500/5"
                : "border-red-500/30 bg-red-500/5"
            )}
          >
            <div className="mt-0.5">
              {cond.result ? (
                <RiCheckboxCircleLine className="h-4 w-4 text-green-600 dark:text-green-400" />
              ) : (
                <RiCloseCircleLine className="h-4 w-4 text-red-600 dark:text-red-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">
                  {cond.type || "condition"}
                </Badge>
                {cond.field && (
                  <span className="text-xs font-mono text-muted-foreground">
                    {cond.field}
                  </span>
                )}
                {cond.operator && (
                  <span className="text-xs font-mono text-primary">
                    {cond.operator}
                  </span>
                )}
                {cond.value !== undefined && (
                  <span className="text-xs font-mono text-muted-foreground">
                    {typeof cond.value === "object"
                      ? JSON.stringify(cond.value)
                      : String(cond.value)}
                  </span>
                )}
              </div>
              {cond.reason && (
                <p className="text-xs text-muted-foreground mt-1">
                  {cond.reason}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface ActionsExecutedPanelProps {
  actions: ActionExecution[] | undefined;
  summary: ActionsSummary | undefined;
}

function ActionsExecutedPanel({
  actions,
  summary,
}: ActionsExecutedPanelProps) {
  if (!actions || actions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">
        No actions were executed
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {summary && (
        <div className="flex items-center gap-3 text-xs">
          <span className="text-muted-foreground">
            Total: <span className="font-medium">{summary.total}</span>
          </span>
          <span className="text-green-600 dark:text-green-400">
            Succeeded: <span className="font-medium">{summary.succeeded}</span>
          </span>
          {summary.failed > 0 && (
            <span className="text-red-600 dark:text-red-400">
              Failed: <span className="font-medium">{summary.failed}</span>
            </span>
          )}
          {summary.skipped > 0 && (
            <span className="text-muted-foreground">
              Skipped: <span className="font-medium">{summary.skipped}</span>
            </span>
          )}
        </div>
      )}
      <div className="space-y-2">
        {actions.map((action, index) => {
          const ActionIcon = getActionIcon(action.action_type || "unknown");
          const isSuccess = action.result === "success";
          const isError = action.result === "error" || !!action.error;

          return (
            <div
              key={index}
              className={cn(
                "p-2 rounded-lg border",
                isSuccess
                  ? "border-green-500/30 bg-green-500/5"
                  : isError
                  ? "border-red-500/30 bg-red-500/5"
                  : "border-border bg-muted/30"
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <ActionIcon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  {action.action_type || "Unknown Action"}
                </span>
                <Badge
                  variant="secondary"
                  className={cn(
                    "text-xs ml-auto",
                    isSuccess
                      ? "bg-green-500/10 text-green-600 dark:text-green-400"
                      : isError
                      ? "bg-red-500/10 text-red-600 dark:text-red-400"
                      : "bg-muted"
                  )}
                >
                  {action.result}
                </Badge>
              </div>
              {action.error && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                  {action.error}
                </p>
              )}
              {action.details && Object.keys(action.details).length > 0 && (
                <div className="bg-muted/50 rounded p-2 mt-2">
                  <pre className="text-xs font-mono overflow-auto max-h-24">
                    {JSON.stringify(action.details, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface CallSnapshotPanelProps {
  snapshot: CallSnapshot | undefined;
}

function CallSnapshotPanel({ snapshot }: CallSnapshotPanelProps) {
  if (!snapshot) {
    return (
      <p className="text-sm text-muted-foreground italic">
        No call snapshot available
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {snapshot.title && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Title:</span>
          <span className="text-sm font-medium">{snapshot.title}</span>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 text-xs">
        {snapshot.duration_minutes !== undefined && (
          <div>
            <span className="text-muted-foreground">Duration:</span>{" "}
            <span className="font-medium">{snapshot.duration_minutes} min</span>
          </div>
        )}
        {snapshot.participant_count !== undefined && (
          <div>
            <span className="text-muted-foreground">Participants:</span>{" "}
            <span className="font-medium">{snapshot.participant_count}</span>
          </div>
        )}
        {snapshot.sentiment && (
          <div>
            <span className="text-muted-foreground">Sentiment:</span>{" "}
            <Badge
              variant="secondary"
              className={cn(
                "text-xs ml-1",
                snapshot.sentiment === "positive"
                  ? "bg-green-500/10 text-green-600"
                  : snapshot.sentiment === "negative"
                  ? "bg-red-500/10 text-red-600"
                  : "bg-gray-500/10 text-gray-600"
              )}
            >
              {snapshot.sentiment}
              {snapshot.sentiment_confidence &&
                ` (${Math.round(snapshot.sentiment_confidence * 100)}%)`}
            </Badge>
          </div>
        )}
        {snapshot.has_transcript !== undefined && (
          <div>
            <span className="text-muted-foreground">Transcript:</span>{" "}
            <span className="font-medium">
              {snapshot.has_transcript ? "Yes" : "No"}
            </span>
          </div>
        )}
        {snapshot.has_summary !== undefined && (
          <div>
            <span className="text-muted-foreground">Summary:</span>{" "}
            <span className="font-medium">
              {snapshot.has_summary ? "Yes" : "No"}
            </span>
          </div>
        )}
        {snapshot.recording_id && (
          <div>
            <span className="text-muted-foreground">Recording ID:</span>{" "}
            <span className="font-mono">{snapshot.recording_id}</span>
          </div>
        )}
      </div>
      {snapshot.tags && snapshot.tags.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Tags:</span>
          {snapshot.tags.map((tag, i) => (
            <Badge key={i} variant="outline" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Execution Row Component
// ============================================================================

interface ExecutionRowProps {
  execution: ExecutionRecord;
}

function ExecutionRow({ execution }: ExecutionRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const debugInfo = execution.debug_info || {};
  const TriggerIcon = getTriggerIcon(execution.trigger_type);

  const hasDebugData =
    debugInfo.trigger_result ||
    (debugInfo.conditions_evaluated && debugInfo.conditions_evaluated.length > 0) ||
    (debugInfo.actions_executed && debugInfo.actions_executed.length > 0) ||
    debugInfo.call_snapshot;

  return (
    <div
      className={cn(
        "border rounded-lg transition-colors",
        execution.success
          ? "border-border"
          : "border-red-500/30 bg-red-500/5"
      )}
    >
      {/* Row Header */}
      <div
        className={cn(
          "flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/30 transition-colors",
          isExpanded && "border-b border-border"
        )}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* Expand indicator */}
        {hasDebugData ? (
          isExpanded ? (
            <RiArrowDownSLine className="h-5 w-5 text-muted-foreground shrink-0" />
          ) : (
            <RiArrowRightSLine className="h-5 w-5 text-muted-foreground shrink-0" />
          )
        ) : (
          <div className="w-5" />
        )}

        {/* Status */}
        <div className="shrink-0">
          {execution.success ? (
            <RiCheckLine className="h-5 w-5 text-green-600 dark:text-green-400" />
          ) : (
            <RiCloseLine className="h-5 w-5 text-red-600 dark:text-red-400" />
          )}
        </div>

        {/* Trigger type */}
        <Badge
          variant="secondary"
          className={cn("text-xs gap-1 shrink-0", getTriggerColor(execution.trigger_type))}
        >
          <TriggerIcon className="h-3 w-3" />
          {getTriggerLabel(execution.trigger_type)}
        </Badge>

        {/* Rule name from debug info */}
        {debugInfo.rule_name && (
          <span className="text-sm text-muted-foreground truncate hidden sm:block">
            {debugInfo.rule_name}
          </span>
        )}

        {/* Error message preview */}
        {!execution.success && execution.error_message && (
          <span className="text-sm text-red-600 dark:text-red-400 truncate flex-1">
            {execution.error_message}
          </span>
        )}

        {/* Execution time */}
        {execution.execution_time_ms !== null && (
          <span className="text-xs text-muted-foreground ml-auto shrink-0 hidden md:block">
            {formatDuration(execution.execution_time_ms)}
          </span>
        )}

        {/* Timestamp */}
        <span className="text-xs text-muted-foreground shrink-0">
          {formatRelativeTime(execution.triggered_at)}
        </span>
      </div>

      {/* Expanded Debug Details */}
      {isExpanded && hasDebugData && (
        <div className="p-3 space-y-2 bg-muted/10">
          {/* Error message */}
          {!execution.success && execution.error_message && (
            <div className="flex items-start gap-2 p-2 rounded-lg bg-red-500/10 border border-red-500/30">
              <RiAlertLine className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-600 dark:text-red-400">
                  Error
                </p>
                <p className="text-sm text-red-600/80 dark:text-red-400/80">
                  {execution.error_message}
                </p>
              </div>
            </div>
          )}

          {/* Execution metadata */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground px-1">
            <span>
              <span className="font-medium">Triggered:</span>{" "}
              {formatDateTime(execution.triggered_at)}
            </span>
            {execution.completed_at && (
              <span>
                <span className="font-medium">Completed:</span>{" "}
                {formatDateTime(execution.completed_at)}
              </span>
            )}
            {execution.execution_time_ms !== null && (
              <span>
                <span className="font-medium">Duration:</span>{" "}
                {formatDuration(execution.execution_time_ms)}
              </span>
            )}
          </div>

          {/* Debug sections */}
          <div className="space-y-1 pt-2">
            {debugInfo.trigger_result && (
              <DebugSection
                title="Trigger Result"
                icon={RiPlayCircleLine}
                defaultOpen
                badge={
                  <Badge
                    variant="secondary"
                    className={cn(
                      "text-xs",
                      debugInfo.trigger_result.fires
                        ? "bg-green-500/10 text-green-600"
                        : "bg-red-500/10 text-red-600"
                    )}
                  >
                    {debugInfo.trigger_result.fires ? "Fired" : "Not Fired"}
                  </Badge>
                }
              >
                <TriggerResultPanel
                  triggerResult={debugInfo.trigger_result}
                  triggerType={execution.trigger_type}
                />
              </DebugSection>
            )}

            {debugInfo.conditions_evaluated &&
              debugInfo.conditions_evaluated.length > 0 && (
                <DebugSection
                  title="Conditions Evaluated"
                  icon={RiFilterLine}
                  badge={
                    <Badge variant="secondary" className="text-xs">
                      {debugInfo.conditions_evaluated.filter((c) => c.result).length}/
                      {debugInfo.conditions_evaluated.length} passed
                    </Badge>
                  }
                >
                  <ConditionsEvaluatedPanel
                    conditions={debugInfo.conditions_evaluated}
                    summary={debugInfo.conditions_summary}
                  />
                </DebugSection>
              )}

            {debugInfo.actions_executed &&
              debugInfo.actions_executed.length > 0 && (
                <DebugSection
                  title="Actions Executed"
                  icon={RiFlowChart}
                  badge={
                    debugInfo.actions_summary && (
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-xs",
                          debugInfo.actions_summary.failed > 0
                            ? "bg-red-500/10 text-red-600"
                            : "bg-green-500/10 text-green-600"
                        )}
                      >
                        {debugInfo.actions_summary.succeeded}/{debugInfo.actions_summary.total}{" "}
                        succeeded
                      </Badge>
                    )
                  }
                >
                  <ActionsExecutedPanel
                    actions={debugInfo.actions_executed}
                    summary={debugInfo.actions_summary}
                  />
                </DebugSection>
              )}

            {debugInfo.call_snapshot && (
              <DebugSection title="Call Snapshot" icon={RiFileListLine}>
                <CallSnapshotPanel snapshot={debugInfo.call_snapshot} />
              </DebugSection>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Stats Component
// ============================================================================

interface ExecutionStatsProps {
  executions: ExecutionRecord[];
}

function ExecutionStats({ executions }: ExecutionStatsProps) {
  const stats = useMemo(() => {
    const total = executions.length;
    const successful = executions.filter((e) => e.success).length;
    const failed = total - successful;
    const successRate = total > 0 ? Math.round((successful / total) * 100) : 0;

    const withDuration = executions.filter((e) => e.execution_time_ms !== null);
    const avgDuration =
      withDuration.length > 0
        ? Math.round(
            withDuration.reduce((sum, e) => sum + (e.execution_time_ms || 0), 0) /
              withDuration.length
          )
        : 0;

    return { total, successful, failed, successRate, avgDuration };
  }, [executions]);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="bg-muted/30 rounded-lg p-3">
        <p className="text-sm text-muted-foreground">Total Runs</p>
        <p className="text-2xl font-bold">{stats.total}</p>
      </div>
      <div className="bg-green-500/10 rounded-lg p-3">
        <p className="text-sm text-green-600 dark:text-green-400">Success Rate</p>
        <p className="text-2xl font-bold text-green-600 dark:text-green-400">
          {stats.successRate}%
        </p>
      </div>
      {stats.failed > 0 && (
        <div className="bg-red-500/10 rounded-lg p-3">
          <p className="text-sm text-red-600 dark:text-red-400">Failed</p>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">
            {stats.failed}
          </p>
        </div>
      )}
      {stats.avgDuration > 0 && (
        <div className="bg-muted/30 rounded-lg p-3">
          <p className="text-sm text-muted-foreground">Avg Duration</p>
          <p className="text-2xl font-bold">{formatDuration(stats.avgDuration)}</p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function ExecutionHistory() {
  const { ruleId } = useParams<{ ruleId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // Fetch data
  const { executions, rule, isLoading, refetch } = useExecutionHistory(
    ruleId,
    user?.id
  );

  // Filter executions
  const filteredExecutions = useMemo(() => {
    return executions.filter((exec) => {
      // Status filter
      if (statusFilter === "success" && !exec.success) return false;
      if (statusFilter === "failure" && exec.success) return false;

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const debugInfo = exec.debug_info || {};
        return (
          (debugInfo.rule_name?.toLowerCase().includes(query) ?? false) ||
          (exec.error_message?.toLowerCase().includes(query) ?? false) ||
          exec.trigger_type.toLowerCase().includes(query)
        );
      }

      return true;
    });
  }, [executions, statusFilter, searchQuery]);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    toast.promise(refetch(), {
      loading: "Refreshing...",
      success: "Refreshed",
      error: "Failed to refresh",
    });
  }, [refetch]);

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
        <RiFlowChart className="h-16 w-16 text-muted-foreground opacity-50" />
        <p className="text-muted-foreground">Please sign in to view execution history</p>
        <Button onClick={() => navigate("/login")}>SIGN IN</Button>
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
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/automation-rules")}
              className="gap-1 -ml-2"
            >
              <RiArrowLeftLine className="h-4 w-4" />
              Rules
            </Button>
            <span className="text-muted-foreground">/</span>
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              EXECUTION HISTORY
            </p>
          </div>
          <div className="flex items-end justify-between gap-4 mb-4">
            <div className="flex-1 min-w-0">
              <h1 className="font-display text-2xl md:text-4xl font-extrabold text-foreground uppercase tracking-wide mb-0.5">
                {rule?.name || "Loading..."}
              </h1>
              <p className="text-sm text-muted-foreground">
                {filteredExecutions.length} execution
                {filteredExecutions.length !== 1 ? "s" : ""}
                {statusFilter !== "all" && ` (filtered)`}
              </p>
            </div>
            {/* Actions */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                className="gap-2"
              >
                <RiRefreshLine className="h-4 w-4" />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Filters & Stats */}
        <div className="px-4 md:px-10 py-4 border-b border-border bg-muted/20 space-y-4">
          {/* Stats */}
          {executions.length > 0 && <ExecutionStats executions={executions} />}

          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <RiSearchLine className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search executions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 pl-8 text-sm"
              />
            </div>

            {/* Status filter */}
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as StatusFilter)}
            >
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="failure">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Execution List */}
        <div className="flex-1 overflow-auto p-4 md:p-10">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <RiLoader2Line className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : executions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <RiTimeLine className="h-16 w-16 text-muted-foreground opacity-50" />
              <div className="text-center">
                <h2 className="text-lg font-semibold mb-1">No execution history</h2>
                <p className="text-sm text-muted-foreground max-w-md">
                  This rule hasn&apos;t been triggered yet. Execution history will appear here
                  once the rule processes calls.
                </p>
              </div>
            </div>
          ) : filteredExecutions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <RiSearchLine className="h-12 w-12 text-muted-foreground opacity-50" />
              <p className="text-sm text-muted-foreground">
                No executions match your filters
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                }}
              >
                Clear Filters
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredExecutions.map((execution) => (
                <ExecutionRow key={execution.id} execution={execution} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export { ExecutionHistory };
