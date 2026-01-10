import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  RiLoader2Line,
  RiSave3Line,
  RiArrowLeftLine,
  RiPlayCircleLine,
  RiChatVoiceLine,
  RiEmotionLine,
  RiTimeLine,
  RiWebhookLine,
  RiCalendarLine,
  RiFlowChart,
  RiAddLine,
  RiDeleteBinLine,
  RiInformationLine,
} from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";
import { ConditionBuilder } from "./ConditionBuilder";

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

type ScheduleType = "interval" | "daily" | "weekly" | "monthly" | "cron";
type SentimentValue = "positive" | "neutral" | "negative";
type PhraseMatchType = "exact" | "contains" | "regex" | "word_boundary";
type DurationOperator =
  | "greater_than"
  | "less_than"
  | "equal"
  | "between"
  | "greater_than_or_equal"
  | "less_than_or_equal";

interface TriggerConfig {
  // Phrase trigger
  phrases?: string[];
  match_type?: PhraseMatchType;
  case_sensitive?: boolean;
  // Sentiment trigger
  sentiment?: SentimentValue;
  confidence_threshold?: number;
  // Duration trigger
  operator?: DurationOperator;
  minutes?: number;
  max_minutes?: number;
  // Webhook trigger
  event_types?: string[];
  source_filter?: string;
  // Scheduled trigger
  schedule_type?: ScheduleType;
  interval_minutes?: number;
  time?: string;
  day_of_week?: number;
  day_of_month?: number;
  cron_expression?: string;
  timezone?: string;
}

interface ConditionGroup {
  operator: "AND" | "OR";
  conditions: Array<{
    id?: string;
    field?: string;
    operator?: string;
    value?: Record<string, unknown>;
    condition_type?: string;
    logic_operator?: "AND" | "OR";
    conditions?: Array<Record<string, unknown>>;
  }>;
}

interface RuleFormData {
  name: string;
  description: string;
  priority: number;
  trigger_type: TriggerType;
  trigger_config: TriggerConfig;
  conditions: ConditionGroup;
  actions: Array<Record<string, unknown>>;
  enabled: boolean;
}

interface AutomationRule extends RuleFormData {
  id: string;
  user_id: string;
  times_applied: number;
  last_applied_at: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Constants
// ============================================================================

const TRIGGER_OPTIONS: Array<{
  value: TriggerType;
  label: string;
  description: string;
  icon: typeof RiPlayCircleLine;
  color: string;
}> = [
  {
    value: "call_created",
    label: "Call Created",
    description: "Triggers when a new call is imported or recorded",
    icon: RiPlayCircleLine,
    color: "bg-green-500/10 text-green-600 dark:text-green-400",
  },
  {
    value: "transcript_phrase",
    label: "Phrase Match",
    description: "Triggers when specific phrases are detected in the transcript",
    icon: RiChatVoiceLine,
    color: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  {
    value: "sentiment",
    label: "Sentiment",
    description: "Triggers based on the detected sentiment of the call",
    icon: RiEmotionLine,
    color: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  },
  {
    value: "duration",
    label: "Duration",
    description: "Triggers based on call duration thresholds",
    icon: RiTimeLine,
    color: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  },
  {
    value: "webhook",
    label: "Webhook",
    description: "Triggers when an external webhook event is received",
    icon: RiWebhookLine,
    color: "bg-pink-500/10 text-pink-600 dark:text-pink-400",
  },
  {
    value: "scheduled",
    label: "Scheduled",
    description: "Triggers on a recurring schedule (daily, weekly, etc.)",
    icon: RiCalendarLine,
    color: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
  },
];

const SENTIMENT_OPTIONS: Array<{ value: SentimentValue; label: string }> = [
  { value: "positive", label: "Positive" },
  { value: "neutral", label: "Neutral" },
  { value: "negative", label: "Negative" },
];

const DURATION_OPERATORS: Array<{ value: DurationOperator; label: string }> = [
  { value: "greater_than", label: "Greater than" },
  { value: "greater_than_or_equal", label: "Greater than or equal" },
  { value: "less_than", label: "Less than" },
  { value: "less_than_or_equal", label: "Less than or equal" },
  { value: "equal", label: "Equal to" },
  { value: "between", label: "Between" },
];

const SCHEDULE_TYPES: Array<{ value: ScheduleType; label: string }> = [
  { value: "interval", label: "Every X minutes" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "cron", label: "Custom (cron)" },
];

const PHRASE_MATCH_TYPES: Array<{ value: PhraseMatchType; label: string }> = [
  { value: "contains", label: "Contains" },
  { value: "exact", label: "Exact match" },
  { value: "word_boundary", label: "Whole word" },
  { value: "regex", label: "Regex pattern" },
];

const DAYS_OF_WEEK = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

const DEFAULT_FORM_DATA: RuleFormData = {
  name: "",
  description: "",
  priority: 0,
  trigger_type: "call_created",
  trigger_config: {},
  conditions: { operator: "AND", conditions: [] },
  actions: [],
  enabled: true,
};

// ============================================================================
// Helper Components
// ============================================================================

function FormField({
  label,
  htmlFor,
  required,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label htmlFor={htmlFor} className="text-sm font-medium">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
        {hint && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <RiInformationLine className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs">
                <p className="text-xs">{hint}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      {children}
    </div>
  );
}

// ============================================================================
// Trigger Configuration Components
// ============================================================================

interface TriggerConfigProps {
  triggerType: TriggerType;
  config: TriggerConfig;
  onChange: (config: TriggerConfig) => void;
}

function PhraseMatchConfig({ config, onChange }: Omit<TriggerConfigProps, "triggerType">) {
  const phrases = config.phrases || [""];

  const handleAddPhrase = () => {
    onChange({ ...config, phrases: [...phrases, ""] });
  };

  const handleRemovePhrase = (index: number) => {
    const newPhrases = phrases.filter((_, i) => i !== index);
    onChange({ ...config, phrases: newPhrases.length > 0 ? newPhrases : [""] });
  };

  const handlePhraseChange = (index: number, value: string) => {
    const newPhrases = [...phrases];
    newPhrases[index] = value;
    onChange({ ...config, phrases: newPhrases });
  };

  return (
    <div className="space-y-4">
      <FormField label="Phrases to match" required hint="Add one or more phrases to match in the transcript">
        <div className="space-y-2">
          {phrases.map((phrase, index) => (
            <div key={index} className="flex gap-2">
              <Input
                value={phrase}
                onChange={(e) => handlePhraseChange(index, e.target.value)}
                placeholder="Enter phrase..."
                className="flex-1"
              />
              {phrases.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemovePhrase(index)}
                  className="shrink-0"
                >
                  <RiDeleteBinLine className="h-4 w-4 text-muted-foreground" />
                </Button>
              )}
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddPhrase}
            className="gap-2"
          >
            <RiAddLine className="h-4 w-4" />
            Add phrase
          </Button>
        </div>
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Match type">
          <Select
            value={config.match_type || "contains"}
            onValueChange={(value) => onChange({ ...config, match_type: value as PhraseMatchType })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PHRASE_MATCH_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        <FormField label="Case sensitive">
          <div className="flex items-center h-10">
            <Switch
              checked={config.case_sensitive || false}
              onCheckedChange={(checked) => onChange({ ...config, case_sensitive: checked })}
            />
            <span className="ml-2 text-sm text-muted-foreground">
              {config.case_sensitive ? "Yes" : "No"}
            </span>
          </div>
        </FormField>
      </div>
    </div>
  );
}

function SentimentConfig({ config, onChange }: Omit<TriggerConfigProps, "triggerType">) {
  return (
    <div className="space-y-4">
      <FormField label="Sentiment" required>
        <Select
          value={config.sentiment || "negative"}
          onValueChange={(value) => onChange({ ...config, sentiment: value as SentimentValue })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SENTIMENT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>

      <FormField
        label="Confidence threshold"
        hint="Minimum confidence level (0-100%) for the sentiment to trigger"
      >
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            max={100}
            value={(config.confidence_threshold || 0.5) * 100}
            onChange={(e) =>
              onChange({
                ...config,
                confidence_threshold: Math.min(100, Math.max(0, Number(e.target.value))) / 100,
              })
            }
            className="w-24"
          />
          <span className="text-sm text-muted-foreground">%</span>
        </div>
      </FormField>
    </div>
  );
}

function DurationConfig({ config, onChange }: Omit<TriggerConfigProps, "triggerType">) {
  return (
    <div className="space-y-4">
      <FormField label="Condition" required>
        <Select
          value={config.operator || "greater_than"}
          onValueChange={(value) => onChange({ ...config, operator: value as DurationOperator })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DURATION_OPERATORS.map((op) => (
              <SelectItem key={op.value} value={op.value}>
                {op.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>

      <div className="flex items-center gap-4">
        <FormField label="Minutes" required>
          <Input
            type="number"
            min={0}
            value={config.minutes || 0}
            onChange={(e) => onChange({ ...config, minutes: Math.max(0, Number(e.target.value)) })}
            className="w-24"
          />
        </FormField>

        {config.operator === "between" && (
          <>
            <span className="text-muted-foreground pt-6">and</span>
            <FormField label="Max minutes" required>
              <Input
                type="number"
                min={0}
                value={config.max_minutes || 0}
                onChange={(e) =>
                  onChange({ ...config, max_minutes: Math.max(0, Number(e.target.value)) })
                }
                className="w-24"
              />
            </FormField>
          </>
        )}
      </div>
    </div>
  );
}

function WebhookConfig({ config, onChange }: Omit<TriggerConfigProps, "triggerType">) {
  const eventTypes = config.event_types || [""];

  const handleAddEventType = () => {
    onChange({ ...config, event_types: [...eventTypes, ""] });
  };

  const handleRemoveEventType = (index: number) => {
    const newEventTypes = eventTypes.filter((_, i) => i !== index);
    onChange({ ...config, event_types: newEventTypes.length > 0 ? newEventTypes : [""] });
  };

  const handleEventTypeChange = (index: number, value: string) => {
    const newEventTypes = [...eventTypes];
    newEventTypes[index] = value;
    onChange({ ...config, event_types: newEventTypes });
  };

  return (
    <div className="space-y-4">
      <FormField
        label="Event types"
        hint="Filter webhooks by event type (leave empty to match all)"
      >
        <div className="space-y-2">
          {eventTypes.map((eventType, index) => (
            <div key={index} className="flex gap-2">
              <Input
                value={eventType}
                onChange={(e) => handleEventTypeChange(index, e.target.value)}
                placeholder="e.g., call.completed"
                className="flex-1"
              />
              {eventTypes.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveEventType(index)}
                  className="shrink-0"
                >
                  <RiDeleteBinLine className="h-4 w-4 text-muted-foreground" />
                </Button>
              )}
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddEventType}
            className="gap-2"
          >
            <RiAddLine className="h-4 w-4" />
            Add event type
          </Button>
        </div>
      </FormField>

      <FormField label="Source filter" hint="Optional: Only match webhooks from this source">
        <Input
          value={config.source_filter || ""}
          onChange={(e) => onChange({ ...config, source_filter: e.target.value })}
          placeholder="e.g., zoom, teams"
        />
      </FormField>
    </div>
  );
}

function ScheduledConfig({ config, onChange }: Omit<TriggerConfigProps, "triggerType">) {
  const scheduleType = config.schedule_type || "daily";

  return (
    <div className="space-y-4">
      <FormField label="Schedule type" required>
        <Select
          value={scheduleType}
          onValueChange={(value) => onChange({ ...config, schedule_type: value as ScheduleType })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SCHEDULE_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>

      {scheduleType === "interval" && (
        <FormField label="Interval (minutes)" required>
          <Input
            type="number"
            min={1}
            value={config.interval_minutes || 60}
            onChange={(e) =>
              onChange({ ...config, interval_minutes: Math.max(1, Number(e.target.value)) })
            }
            className="w-32"
          />
        </FormField>
      )}

      {(scheduleType === "daily" || scheduleType === "weekly" || scheduleType === "monthly") && (
        <FormField label="Time" required hint="Time in 24-hour format (HH:MM)">
          <Input
            type="time"
            value={config.time || "09:00"}
            onChange={(e) => onChange({ ...config, time: e.target.value })}
            className="w-32"
          />
        </FormField>
      )}

      {scheduleType === "weekly" && (
        <FormField label="Day of week" required>
          <Select
            value={String(config.day_of_week ?? 1)}
            onValueChange={(value) => onChange({ ...config, day_of_week: Number(value) })}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DAYS_OF_WEEK.map((day) => (
                <SelectItem key={day.value} value={String(day.value)}>
                  {day.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      )}

      {scheduleType === "monthly" && (
        <FormField label="Day of month" required>
          <Input
            type="number"
            min={1}
            max={31}
            value={config.day_of_month || 1}
            onChange={(e) =>
              onChange({
                ...config,
                day_of_month: Math.min(31, Math.max(1, Number(e.target.value))),
              })
            }
            className="w-24"
          />
        </FormField>
      )}

      {scheduleType === "cron" && (
        <FormField label="Cron expression" required hint="Standard cron format: * * * * *">
          <Input
            value={config.cron_expression || "0 9 * * *"}
            onChange={(e) => onChange({ ...config, cron_expression: e.target.value })}
            placeholder="0 9 * * *"
            className="font-mono"
          />
        </FormField>
      )}

      <FormField label="Timezone" hint="Leave empty for UTC">
        <Input
          value={config.timezone || ""}
          onChange={(e) => onChange({ ...config, timezone: e.target.value })}
          placeholder="e.g., America/New_York"
        />
      </FormField>
    </div>
  );
}

function TriggerConfigEditor({ triggerType, config, onChange }: TriggerConfigProps) {
  switch (triggerType) {
    case "call_created":
      return (
        <p className="text-sm text-muted-foreground italic">
          This trigger fires automatically when any new call is created. No additional configuration needed.
        </p>
      );
    case "transcript_phrase":
      return <PhraseMatchConfig config={config} onChange={onChange} />;
    case "sentiment":
      return <SentimentConfig config={config} onChange={onChange} />;
    case "duration":
      return <DurationConfig config={config} onChange={onChange} />;
    case "webhook":
      return <WebhookConfig config={config} onChange={onChange} />;
    case "scheduled":
      return <ScheduledConfig config={config} onChange={onChange} />;
    default:
      return null;
  }
}

// ============================================================================
// Main Component
// ============================================================================

interface RuleBuilderProps {
  ruleId?: string;
}

export function RuleBuilder({ ruleId: propRuleId }: RuleBuilderProps) {
  const navigate = useNavigate();
  const params = useParams<{ ruleId: string }>();
  const { user, loading: authLoading } = useAuth();

  // Determine ruleId from props or URL params
  const ruleId = propRuleId || params.ruleId;
  const isEditing = !!ruleId && ruleId !== "new";

  // Form state
  const [formData, setFormData] = useState<RuleFormData>(DEFAULT_FORM_DATA);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch existing rule if editing
  const fetchRule = useCallback(async () => {
    if (!ruleId || ruleId === "new" || !user?.id) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("automation_rules")
        .select("*")
        .eq("id", ruleId)
        .eq("user_id", user.id)
        .single();

      if (error) throw error;

      if (data) {
        setFormData({
          name: data.name,
          description: data.description || "",
          priority: data.priority,
          trigger_type: data.trigger_type as TriggerType,
          trigger_config: (data.trigger_config as TriggerConfig) || {},
          conditions: (data.conditions as Record<string, unknown>) || { operator: "AND", conditions: [] },
          actions: (data.actions as Array<Record<string, unknown>>) || [],
          enabled: data.enabled,
        });
      }
    } catch (err) {
      logger.error("Error fetching rule", err);
      toast.error("Failed to load rule");
      navigate("/automation-rules");
    } finally {
      setIsLoading(false);
    }
  }, [ruleId, user?.id, navigate]);

  useEffect(() => {
    if (isEditing) {
      fetchRule();
    }
  }, [isEditing, fetchRule]);

  // Form handlers
  const updateFormData = useCallback((updates: Partial<RuleFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
    setHasChanges(true);
  }, []);

  const handleTriggerTypeChange = useCallback((value: TriggerType) => {
    // Reset trigger config when changing trigger type
    updateFormData({ trigger_type: value, trigger_config: {} });
  }, [updateFormData]);

  const handleTriggerConfigChange = useCallback((config: TriggerConfig) => {
    updateFormData({ trigger_config: config });
  }, [updateFormData]);

  const handleConditionsChange = useCallback((conditions: ConditionGroup) => {
    updateFormData({ conditions });
  }, [updateFormData]);

  const handleSave = async () => {
    if (!user?.id) {
      toast.error("You must be logged in to save rules");
      return;
    }

    if (!formData.name.trim()) {
      toast.error("Please enter a rule name");
      return;
    }

    setIsSaving(true);
    try {
      const ruleData = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        priority: formData.priority,
        trigger_type: formData.trigger_type,
        trigger_config: formData.trigger_config,
        conditions: formData.conditions,
        actions: formData.actions,
        enabled: formData.enabled,
        updated_at: new Date().toISOString(),
      };

      if (isEditing) {
        const { error } = await supabase
          .from("automation_rules")
          .update(ruleData)
          .eq("id", ruleId)
          .eq("user_id", user.id);

        if (error) throw error;
        toast.success("Rule updated successfully");
      } else {
        const { error } = await supabase.from("automation_rules").insert({
          ...ruleData,
          user_id: user.id,
        });

        if (error) throw error;
        toast.success("Rule created successfully");
      }

      setHasChanges(false);
      navigate("/automation-rules");
    } catch (err) {
      logger.error("Error saving rule", err);
      toast.error("Failed to save rule");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (hasChanges) {
      const confirmed = window.confirm(
        "You have unsaved changes. Are you sure you want to leave?"
      );
      if (!confirmed) return;
    }
    navigate("/automation-rules");
  };

  // Loading states
  if (authLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <RiLoader2Line className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4">
        <RiFlowChart className="h-16 w-16 text-muted-foreground opacity-50" />
        <p className="text-muted-foreground">Please sign in to create automation rules</p>
        <Button onClick={() => navigate("/login")}>SIGN IN</Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <RiLoader2Line className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const selectedTrigger = TRIGGER_OPTIONS.find((t) => t.value === formData.trigger_type);

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
              onClick={handleCancel}
              className="gap-2 -ml-2"
            >
              <RiArrowLeftLine className="h-4 w-4" />
              Back
            </Button>
          </div>
          <div className="flex items-end justify-between gap-4 mb-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                AUTOMATION
              </p>
              <h1 className="font-display text-2xl md:text-4xl font-extrabold text-foreground uppercase tracking-wide">
                {isEditing ? "EDIT RULE" : "NEW RULE"}
              </h1>
            </div>
            {/* Actions */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <Button variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaving || !formData.name.trim()}
                className="gap-2"
              >
                {isSaving ? (
                  <RiLoader2Line className="h-4 w-4 animate-spin" />
                ) : (
                  <RiSave3Line className="h-4 w-4" />
                )}
                {isEditing ? "Save Changes" : "Create Rule"}
              </Button>
            </div>
          </div>
        </div>

        {/* Form Content */}
        <div className="flex-1 overflow-auto p-4 md:p-10">
          <div className="max-w-3xl space-y-8">
            {/* Basic Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Basic Information</CardTitle>
                <CardDescription>
                  Give your rule a name and description to help identify it later
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField label="Rule name" htmlFor="name" required>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => updateFormData({ name: e.target.value })}
                    placeholder="e.g., Tag negative sentiment calls"
                    className="max-w-md"
                  />
                </FormField>

                <FormField label="Description" htmlFor="description">
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => updateFormData({ description: e.target.value })}
                    placeholder="Describe what this rule does..."
                    rows={3}
                    className="max-w-md resize-none"
                  />
                </FormField>

                <div className="flex items-center justify-between max-w-md">
                  <FormField label="Enabled">
                    <div className="flex items-center gap-2 mt-1">
                      <Switch
                        checked={formData.enabled}
                        onCheckedChange={(checked) => updateFormData({ enabled: checked })}
                      />
                      <span className="text-sm text-muted-foreground">
                        {formData.enabled ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </FormField>

                  <FormField
                    label="Priority"
                    htmlFor="priority"
                    hint="Lower numbers run first (0 = highest priority)"
                  >
                    <Input
                      id="priority"
                      type="number"
                      min={0}
                      value={formData.priority}
                      onChange={(e) =>
                        updateFormData({ priority: Math.max(0, Number(e.target.value)) })
                      }
                      className="w-20"
                    />
                  </FormField>
                </div>
              </CardContent>
            </Card>

            {/* Trigger Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Trigger</CardTitle>
                <CardDescription>
                  Choose when this automation rule should run
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField label="Trigger type" required>
                  <Select
                    value={formData.trigger_type}
                    onValueChange={handleTriggerTypeChange}
                  >
                    <SelectTrigger className="max-w-md">
                      <SelectValue>
                        {selectedTrigger && (
                          <div className="flex items-center gap-2">
                            <selectedTrigger.icon className="h-4 w-4" />
                            {selectedTrigger.label}
                          </div>
                        )}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {TRIGGER_OPTIONS.map((trigger) => (
                        <SelectItem key={trigger.value} value={trigger.value}>
                          <div className="flex items-center gap-2">
                            <trigger.icon className="h-4 w-4" />
                            <span>{trigger.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>

                {selectedTrigger && (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <Badge
                      variant="secondary"
                      className={cn("shrink-0 mt-0.5", selectedTrigger.color)}
                    >
                      <selectedTrigger.icon className="h-3.5 w-3.5 mr-1" />
                      {selectedTrigger.label}
                    </Badge>
                    <p className="text-sm text-muted-foreground">
                      {selectedTrigger.description}
                    </p>
                  </div>
                )}

                {/* Trigger Configuration */}
                <div className="pt-2">
                  <TriggerConfigEditor
                    triggerType={formData.trigger_type}
                    config={formData.trigger_config}
                    onChange={handleTriggerConfigChange}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Conditions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Conditions</CardTitle>
                <CardDescription>
                  Add conditions to filter when this rule runs. Conditions are checked
                  after the trigger fires.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ConditionBuilder
                  conditions={formData.conditions}
                  onChange={handleConditionsChange}
                />
              </CardContent>
            </Card>

            {/* Actions Placeholder */}
            <Card className="border-dashed">
              <CardHeader>
                <CardTitle className="text-lg text-muted-foreground">
                  Actions
                </CardTitle>
                <CardDescription>
                  Define what happens when this rule is triggered (coming in next update)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground italic">
                  Action builder will be added here...
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RuleBuilder;
