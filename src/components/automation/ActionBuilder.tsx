import { useCallback, useState, useEffect } from "react";
import {
  RiAddLine,
  RiDeleteBinLine,
  RiMailLine,
  RiFolderAddLine,
  RiFolderReduceLine,
  RiPriceTag3Line,
  RiBookmarkLine,
  RiRobot2Line,
  RiHeartPulseLine,
  RiWebhookLine,
  RiTaskLine,
  RiFileListLine,
  RiDraggable,
  RiInformationLine,
  RiArrowUpLine,
  RiArrowDownLine,
} from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// ============================================================================
// Types
// ============================================================================

export type ActionType =
  | "email"
  | "add_to_folder"
  | "remove_from_folder"
  | "add_tag"
  | "remove_tag"
  | "set_category"
  | "run_ai_analysis"
  | "update_client_health"
  | "webhook"
  | "create_task"
  | "generate_digest";

export interface ActionConfig {
  type: ActionType;
  config: Record<string, unknown>;
}

interface Folder {
  id: string;
  name: string;
}

interface Tag {
  id: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
}

// ============================================================================
// Constants
// ============================================================================

const ACTION_TYPES: Array<{
  value: ActionType;
  label: string;
  description: string;
  icon: typeof RiMailLine;
  color: string;
}> = [
  {
    value: "email",
    label: "Send Email",
    description: "Send an email notification",
    icon: RiMailLine,
    color: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  {
    value: "add_to_folder",
    label: "Add to Folder",
    description: "Add the call to a folder",
    icon: RiFolderAddLine,
    color: "bg-green-500/10 text-green-600 dark:text-green-400",
  },
  {
    value: "remove_from_folder",
    label: "Remove from Folder",
    description: "Remove the call from a folder",
    icon: RiFolderReduceLine,
    color: "bg-red-500/10 text-red-600 dark:text-red-400",
  },
  {
    value: "add_tag",
    label: "Add Tag",
    description: "Add a tag to the call",
    icon: RiPriceTag3Line,
    color: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  },
  {
    value: "remove_tag",
    label: "Remove Tag",
    description: "Remove a tag from the call",
    icon: RiPriceTag3Line,
    color: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  },
  {
    value: "set_category",
    label: "Set Category",
    description: "Set the call category",
    icon: RiBookmarkLine,
    color: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  },
  {
    value: "run_ai_analysis",
    label: "Run AI Analysis",
    description: "Trigger AI analysis on the call",
    icon: RiRobot2Line,
    color: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  },
  {
    value: "update_client_health",
    label: "Update Client Health",
    description: "Adjust client health score",
    icon: RiHeartPulseLine,
    color: "bg-pink-500/10 text-pink-600 dark:text-pink-400",
  },
  {
    value: "webhook",
    label: "Send Webhook",
    description: "Send data to an external URL",
    icon: RiWebhookLine,
    color: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
  },
  {
    value: "create_task",
    label: "Create Task",
    description: "Create a task or reminder",
    icon: RiTaskLine,
    color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  {
    value: "generate_digest",
    label: "Generate Digest",
    description: "Generate a summary digest",
    icon: RiFileListLine,
    color: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
];

const AI_ANALYSIS_TYPES = [
  { value: "auto_tag", label: "Auto-Tag" },
  { value: "sentiment", label: "Sentiment Analysis" },
  { value: "summarize", label: "Summarize" },
  { value: "extract_action_items", label: "Extract Action Items" },
  { value: "custom", label: "Custom Prompt" },
];

const DIGEST_TYPES = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "custom", label: "Custom Range" },
];

const WEBHOOK_METHODS = [
  { value: "POST", label: "POST" },
  { value: "GET", label: "GET" },
  { value: "PUT", label: "PUT" },
  { value: "PATCH", label: "PATCH" },
];

const TASK_PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

// ============================================================================
// Helper Functions
// ============================================================================

function generateId(): string {
  return `action-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

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
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
        {hint && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <RiInformationLine className="h-3.5 w-3.5 text-muted-foreground/60 cursor-help" />
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
// Action Configuration Components
// ============================================================================

interface ActionConfigProps {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
  folders: Folder[];
  tags: Tag[];
  categories: Category[];
}

function EmailActionConfig({ config, onChange }: Omit<ActionConfigProps, "folders" | "tags" | "categories">) {
  return (
    <div className="space-y-4">
      <FormField label="To" required hint="Recipient email addresses (comma-separated or use {{user.email}})">
        <Input
          value={String(config.to || "")}
          onChange={(e) => onChange({ ...config, to: e.target.value })}
          placeholder="email@example.com, {{user.email}}"
        />
      </FormField>
      <FormField label="Subject" required>
        <Input
          value={String(config.subject || "")}
          onChange={(e) => onChange({ ...config, subject: e.target.value })}
          placeholder="Alert: {{call.title}}"
        />
      </FormField>
      <FormField label="Body" hint="Use {{call.title}}, {{call.summary}}, etc. for dynamic content">
        <Textarea
          value={String(config.body || "")}
          onChange={(e) => onChange({ ...config, body: e.target.value })}
          placeholder="The call {{call.title}} requires your attention..."
          rows={4}
          className="resize-none"
        />
      </FormField>
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <Switch
            checked={Boolean(config.include_call_link)}
            onCheckedChange={(checked) => onChange({ ...config, include_call_link: checked })}
          />
          <Label className="text-sm">Include call link</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={Boolean(config.include_summary)}
            onCheckedChange={(checked) => onChange({ ...config, include_summary: checked })}
          />
          <Label className="text-sm">Include summary</Label>
        </div>
      </div>
    </div>
  );
}

function FolderActionConfig({ config, onChange, folders }: Pick<ActionConfigProps, "config" | "onChange" | "folders">) {
  return (
    <FormField label="Folder" required>
      <Select
        value={String(config.folder_id || "")}
        onValueChange={(value) => onChange({ ...config, folder_id: value })}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select folder..." />
        </SelectTrigger>
        <SelectContent>
          {folders.length === 0 ? (
            <SelectItem value="_none" disabled>
              No folders available
            </SelectItem>
          ) : (
            folders.map((folder) => (
              <SelectItem key={folder.id} value={folder.id}>
                {folder.name}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </FormField>
  );
}

function TagActionConfig({ config, onChange, tags }: Pick<ActionConfigProps, "config" | "onChange" | "tags">) {
  return (
    <FormField label="Tag" required>
      <Select
        value={String(config.tag_id || "")}
        onValueChange={(value) => onChange({ ...config, tag_id: value })}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select tag..." />
        </SelectTrigger>
        <SelectContent>
          {tags.length === 0 ? (
            <SelectItem value="_none" disabled>
              No tags available
            </SelectItem>
          ) : (
            tags.map((tag) => (
              <SelectItem key={tag.id} value={tag.id}>
                {tag.name}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </FormField>
  );
}

function CategoryActionConfig({ config, onChange, categories }: Pick<ActionConfigProps, "config" | "onChange" | "categories">) {
  return (
    <FormField label="Category" required>
      <Select
        value={String(config.category_id || "")}
        onValueChange={(value) => onChange({ ...config, category_id: value })}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select category..." />
        </SelectTrigger>
        <SelectContent>
          {categories.length === 0 ? (
            <SelectItem value="_none" disabled>
              No categories available
            </SelectItem>
          ) : (
            categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </FormField>
  );
}

function AIAnalysisActionConfig({ config, onChange }: Omit<ActionConfigProps, "folders" | "tags" | "categories">) {
  return (
    <div className="space-y-4">
      <FormField label="Analysis Type" required>
        <Select
          value={String(config.analysis_type || "sentiment")}
          onValueChange={(value) => onChange({ ...config, analysis_type: value })}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AI_ANALYSIS_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>
      {config.analysis_type === "custom" && (
        <FormField label="Custom Prompt" required hint="Describe what analysis to perform">
          <Textarea
            value={String(config.custom_prompt || "")}
            onChange={(e) => onChange({ ...config, custom_prompt: e.target.value })}
            placeholder="Analyze this call for..."
            rows={3}
            className="resize-none"
          />
        </FormField>
      )}
    </div>
  );
}

function ClientHealthActionConfig({ config, onChange }: Omit<ActionConfigProps, "folders" | "tags" | "categories">) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Adjustment" required hint="Positive or negative value to add to health score">
          <Input
            type="number"
            value={Number(config.adjustment) || 0}
            onChange={(e) => onChange({ ...config, adjustment: Number(e.target.value) })}
            placeholder="-10"
          />
        </FormField>
        <FormField label="Set Absolute" hint="Set exact value instead of adjusting">
          <div className="flex items-center h-9">
            <Switch
              checked={Boolean(config.set_absolute)}
              onCheckedChange={(checked) => onChange({ ...config, set_absolute: checked })}
            />
          </div>
        </FormField>
      </div>
      <FormField label="Reason" required hint="Reason for the health score change">
        <Input
          value={String(config.reason || "")}
          onChange={(e) => onChange({ ...config, reason: e.target.value })}
          placeholder="Negative sentiment detected in call"
        />
      </FormField>
      <FormField label="Client Email" hint="Specific client email or use {{participant.email}}. Leave empty to auto-detect.">
        <Input
          value={String(config.client_email || "")}
          onChange={(e) => onChange({ ...config, client_email: e.target.value })}
          placeholder="{{participant.email}}"
        />
      </FormField>
    </div>
  );
}

function WebhookActionConfig({ config, onChange }: Omit<ActionConfigProps, "folders" | "tags" | "categories">) {
  return (
    <div className="space-y-4">
      <FormField label="URL" required>
        <Input
          value={String(config.url || "")}
          onChange={(e) => onChange({ ...config, url: e.target.value })}
          placeholder="https://api.example.com/webhook"
        />
      </FormField>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Method">
          <Select
            value={String(config.method || "POST")}
            onValueChange={(value) => onChange({ ...config, method: value })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WEBHOOK_METHODS.map((method) => (
                <SelectItem key={method.value} value={method.value}>
                  {method.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="Include Call Data">
          <div className="flex items-center h-9">
            <Switch
              checked={config.include_call_data !== false}
              onCheckedChange={(checked) => onChange({ ...config, include_call_data: checked })}
            />
          </div>
        </FormField>
      </div>
      <FormField label="Custom Body (JSON)" hint="Override default body with custom JSON template">
        <Textarea
          value={String(config.body_template || "")}
          onChange={(e) => onChange({ ...config, body_template: e.target.value })}
          placeholder='{"event": "call_alert", "title": "{{call.title}}"}'
          rows={3}
          className="font-mono text-sm resize-none"
        />
      </FormField>
    </div>
  );
}

function CreateTaskActionConfig({ config, onChange }: Omit<ActionConfigProps, "folders" | "tags" | "categories">) {
  return (
    <div className="space-y-4">
      <FormField label="Title" required>
        <Input
          value={String(config.title || "")}
          onChange={(e) => onChange({ ...config, title: e.target.value })}
          placeholder="Follow up on: {{call.title}}"
        />
      </FormField>
      <FormField label="Description">
        <Textarea
          value={String(config.description || "")}
          onChange={(e) => onChange({ ...config, description: e.target.value })}
          placeholder="Review the call and take appropriate action..."
          rows={2}
          className="resize-none"
        />
      </FormField>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Due In (Days)">
          <Input
            type="number"
            min={0}
            value={Number(config.due_in_days) || ""}
            onChange={(e) => onChange({ ...config, due_in_days: Number(e.target.value) || undefined })}
            placeholder="3"
          />
        </FormField>
        <FormField label="Priority">
          <Select
            value={String(config.priority || "medium")}
            onValueChange={(value) => onChange({ ...config, priority: value })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TASK_PRIORITIES.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      </div>
    </div>
  );
}

function GenerateDigestActionConfig({ config, onChange }: Omit<ActionConfigProps, "folders" | "tags" | "categories">) {
  return (
    <div className="space-y-4">
      <FormField label="Digest Type" required>
        <Select
          value={String(config.digest_type || "weekly")}
          onValueChange={(value) => onChange({ ...config, digest_type: value })}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DIGEST_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>
      {config.digest_type === "custom" && (
        <FormField label="Date Range (Days)" required>
          <Input
            type="number"
            min={1}
            value={Number(config.date_range_days) || 7}
            onChange={(e) => onChange({ ...config, date_range_days: Number(e.target.value) })}
          />
        </FormField>
      )}
      <FormField label="Email To" hint="Send digest to this email (leave empty to skip email)">
        <Input
          value={String(config.email_to || "")}
          onChange={(e) => onChange({ ...config, email_to: e.target.value })}
          placeholder="{{user.email}}"
        />
      </FormField>
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <Switch
            checked={config.include_calls !== false}
            onCheckedChange={(checked) => onChange({ ...config, include_calls: checked })}
          />
          <Label className="text-sm">Include call list</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={config.include_stats !== false}
            onCheckedChange={(checked) => onChange({ ...config, include_stats: checked })}
          />
          <Label className="text-sm">Include statistics</Label>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Action Row Component
// ============================================================================

interface ActionRowProps {
  action: ActionConfig & { id?: string };
  index: number;
  totalCount: number;
  onUpdate: (action: ActionConfig & { id?: string }) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  folders: Folder[];
  tags: Tag[];
  categories: Category[];
}

function ActionRow({
  action,
  index,
  totalCount,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
  folders,
  tags,
  categories,
}: ActionRowProps) {
  const actionTypeInfo = ACTION_TYPES.find((t) => t.value === action.type);

  const handleTypeChange = (type: ActionType) => {
    onUpdate({
      ...action,
      type,
      config: {},
    });
  };

  const handleConfigChange = (config: Record<string, unknown>) => {
    onUpdate({
      ...action,
      config,
    });
  };

  const renderConfigEditor = () => {
    switch (action.type) {
      case "email":
        return <EmailActionConfig config={action.config} onChange={handleConfigChange} />;
      case "add_to_folder":
      case "remove_from_folder":
        return <FolderActionConfig config={action.config} onChange={handleConfigChange} folders={folders} />;
      case "add_tag":
      case "remove_tag":
        return <TagActionConfig config={action.config} onChange={handleConfigChange} tags={tags} />;
      case "set_category":
        return <CategoryActionConfig config={action.config} onChange={handleConfigChange} categories={categories} />;
      case "run_ai_analysis":
        return <AIAnalysisActionConfig config={action.config} onChange={handleConfigChange} />;
      case "update_client_health":
        return <ClientHealthActionConfig config={action.config} onChange={handleConfigChange} />;
      case "webhook":
        return <WebhookActionConfig config={action.config} onChange={handleConfigChange} />;
      case "create_task":
        return <CreateTaskActionConfig config={action.config} onChange={handleConfigChange} />;
      case "generate_digest":
        return <GenerateDigestActionConfig config={action.config} onChange={handleConfigChange} />;
      default:
        return null;
    }
  };

  return (
    <div className="relative rounded-lg border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-muted/30 border-b border-border">
        <div className="flex items-center gap-1 text-muted-foreground">
          <RiDraggable className="h-4 w-4" />
          <span className="text-xs font-medium">#{index + 1}</span>
        </div>

        <Select value={action.type} onValueChange={handleTypeChange}>
          <SelectTrigger className="flex-1 max-w-[200px]">
            <SelectValue>
              {actionTypeInfo && (
                <div className="flex items-center gap-2">
                  <actionTypeInfo.icon className="h-4 w-4" />
                  {actionTypeInfo.label}
                </div>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {ACTION_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                <div className="flex items-center gap-2">
                  <type.icon className="h-4 w-4" />
                  {type.label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {actionTypeInfo && (
          <Badge variant="secondary" className={cn("text-xs", actionTypeInfo.color)}>
            {actionTypeInfo.description}
          </Badge>
        )}

        <div className="flex-1" />

        {/* Move buttons */}
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onMoveUp}
            disabled={index === 0}
            className="h-7 w-7"
          >
            <RiArrowUpLine className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onMoveDown}
            disabled={index === totalCount - 1}
            className="h-7 w-7"
          >
            <RiArrowDownLine className="h-4 w-4" />
          </Button>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
        >
          <RiDeleteBinLine className="h-4 w-4" />
        </Button>
      </div>

      {/* Config Editor */}
      <div className="p-4">
        {renderConfigEditor()}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

interface ActionBuilderProps {
  actions: Array<Record<string, unknown>>;
  onChange: (actions: Array<Record<string, unknown>>) => void;
}

export function ActionBuilder({ actions, onChange }: ActionBuilderProps) {
  const { user } = useAuth();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  // Fetch folders, tags, and categories on mount
  useEffect(() => {
    async function fetchOptions() {
      if (!user?.id) return;

      const [foldersRes, tagsRes, categoriesRes] = await Promise.all([
        supabase
          .from("call_folders")
          .select("id, name")
          .eq("user_id", user.id)
          .order("name"),
        supabase
          .from("call_tags")
          .select("id, name")
          .eq("user_id", user.id)
          .order("name"),
        supabase
          .from("call_categories")
          .select("id, name")
          .eq("user_id", user.id)
          .order("name"),
      ]);

      if (foldersRes.data) setFolders(foldersRes.data);
      if (tagsRes.data) setTags(tagsRes.data);
      if (categoriesRes.data) setCategories(categoriesRes.data);
    }

    fetchOptions();
  }, [user?.id]);

  // Normalize actions to have proper type
  const actionList = (actions || []).map((a, i) => ({
    id: (a as Record<string, unknown>).id as string || `action-${i}`,
    type: ((a as Record<string, unknown>).type as ActionType) || "email",
    config: ((a as Record<string, unknown>).config as Record<string, unknown>) || {},
  }));

  const handleAddAction = useCallback(() => {
    const newAction = {
      id: generateId(),
      type: "email" as ActionType,
      config: {},
    };
    onChange([...actionList, newAction]);
  }, [actionList, onChange]);

  const handleUpdateAction = useCallback(
    (index: number, updatedAction: ActionConfig & { id?: string }) => {
      const newActions = [...actionList];
      newActions[index] = updatedAction;
      onChange(newActions);
    },
    [actionList, onChange]
  );

  const handleRemoveAction = useCallback(
    (index: number) => {
      const newActions = actionList.filter((_, i) => i !== index);
      onChange(newActions);
    },
    [actionList, onChange]
  );

  const handleMoveUp = useCallback(
    (index: number) => {
      if (index === 0) return;
      const newActions = [...actionList];
      [newActions[index - 1], newActions[index]] = [newActions[index], newActions[index - 1]];
      onChange(newActions);
    },
    [actionList, onChange]
  );

  const handleMoveDown = useCallback(
    (index: number) => {
      if (index === actionList.length - 1) return;
      const newActions = [...actionList];
      [newActions[index], newActions[index + 1]] = [newActions[index + 1], newActions[index]];
      onChange(newActions);
    },
    [actionList, onChange]
  );

  return (
    <div className="space-y-4">
      {/* Action list */}
      {actionList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 px-4 text-center border-2 border-dashed border-border rounded-lg">
          <RiRobot2Line className="h-8 w-8 text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground mb-4">
            No actions added yet. Add actions to define what happens when this rule is triggered.
          </p>
          <Button type="button" variant="outline" size="sm" onClick={handleAddAction} className="gap-2">
            <RiAddLine className="h-4 w-4" />
            Add Action
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {actionList.map((action, index) => (
            <ActionRow
              key={action.id || index}
              action={action}
              index={index}
              totalCount={actionList.length}
              onUpdate={(updated) => handleUpdateAction(index, updated)}
              onRemove={() => handleRemoveAction(index)}
              onMoveUp={() => handleMoveUp(index)}
              onMoveDown={() => handleMoveDown(index)}
              folders={folders}
              tags={tags}
              categories={categories}
            />
          ))}
        </div>
      )}

      {/* Add action button (shown when there are actions) */}
      {actionList.length > 0 && (
        <Button type="button" variant="outline" size="sm" onClick={handleAddAction} className="gap-2">
          <RiAddLine className="h-4 w-4" />
          Add Another Action
        </Button>
      )}

      {/* Execution order note */}
      {actionList.length > 1 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 text-sm">
          <RiInformationLine className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground">
            Actions are executed in order from top to bottom. Use the arrows to reorder.
          </span>
        </div>
      )}
    </div>
  );
}

export default ActionBuilder;
