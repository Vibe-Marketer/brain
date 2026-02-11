import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";
import { supabase } from "@/integrations/supabase/client";
import { useBankContext } from "@/hooks/useBankContext";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  RiAddLine,
  RiDeleteBinLine,
  RiEditLine,
  RiFolderLine,
  RiLoader2Line,
  RiPlayLine,
  RiFlowChart,
} from "@remixicon/react";
import QuickCreateTagDialog from "@/components/QuickCreateTagDialog";
import QuickCreateFolderDialog from "@/components/QuickCreateFolderDialog";

interface RuleConditions {
  title?: string;
  contains?: string;
  pattern?: string;
  keywords?: string[];
  search_chars?: number;
  day_of_week?: number;
  hour?: number;
}

interface Rule {
  id: string;
  name: string;
  description: string | null;
  rule_type: string;
  conditions: RuleConditions;
  tag_id: string | null;
  folder_id: string | null;
  priority: number;
  is_active: boolean | null;
  times_applied: number | null;
  last_applied_at: string | null;
  created_at: string | null;
}

interface Tag {
  id: string;
  name: string;
  color: string | null;
}

interface Folder {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
}

const RULE_TYPES = [
  { value: "title_exact", label: "Title Exact Match" },
  { value: "title_contains", label: "Title Contains" },
  { value: "title_regex", label: "Title Regex" },
  { value: "transcript_keyword", label: "Transcript Keywords" },
  { value: "day_time", label: "Day/Time" },
];

export function RulesTab() {
  const queryClient = useQueryClient();
  const { activeBankId } = useBankContext();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState<string | null>(null);

  // Inline creation dialogs
  const [inlineTagDialogOpen, setInlineTagDialogOpen] = useState(false);
  const [inlineFolderDialogOpen, setInlineFolderDialogOpen] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    rule_type: "title_exact",
    tag_id: "",
    folder_id: "",
    priority: 100,
    conditions: {} as RuleConditions,
  });

  // --- Keyboard Shortcuts ---
  // Cmd+N: Open create rule dialog
  const handleCreateShortcut = useCallback(() => {
    setEditingRule(null);
    setFormData({
      name: "",
      description: "",
      rule_type: "title_exact",
      tag_id: "",
      folder_id: "",
      priority: 100,
      conditions: {},
    });
    setDialogOpen(true);
  }, []);

  // Register keyboard shortcuts
  useKeyboardShortcut(handleCreateShortcut, { key: 'n' });

  // Fetch rules
  const { data: rules, isLoading: rulesLoading, error: rulesError } = useQuery({
    queryKey: ["tag-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tag_rules")
        .select("*")
        .order("priority");

      if (error) throw error;
      return data as Rule[];
    },
  });

  // Fetch tags scoped to active bank/workspace
  const { data: tags } = useQuery({
    queryKey: ["call-tags", activeBankId],
    queryFn: async () => {
      let query = supabase
        .from("call_tags")
        .select("id, name, color")
        .order("name");

      if (activeBankId) {
        query = query.eq("bank_id", activeBankId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Tag[];
    },
  });

  // Fetch folders scoped to active bank/workspace
  const { data: folders } = useQuery({
    queryKey: ["folders", activeBankId],
    queryFn: async () => {
      let query = supabase
        .from("folders")
        .select("id, name, color, icon")
        .order("name");

      if (activeBankId) {
        query = query.eq("bank_id", activeBankId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Folder[];
    },
  });

  // Toggle rule active status
  const toggleRuleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("tag_rules")
        .update({ is_active: isActive })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tag-rules"] });
    },
    onError: (error) => {
      toast.error(`Failed to update rule: ${error.message}`);
    },
  });

  // Create/Update rule
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not authenticated");

      // Convert empty strings to null for database
      const tag_id = data.tag_id || null;
      const folder_id = data.folder_id || null;

      if (editingRule) {
        const { error } = await supabase
          .from("tag_rules")
          .update({
            name: data.name,
            description: data.description || null,
            rule_type: data.rule_type,
            tag_id,
            folder_id,
            priority: data.priority,
            conditions: data.conditions,
          })
          .eq("id", editingRule.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("tag_rules").insert({
          user_id: userData.user.id,
          name: data.name,
          description: data.description || null,
          rule_type: data.rule_type,
          tag_id,
          folder_id,
          priority: data.priority,
          conditions: data.conditions,
          is_active: true,
        });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingRule ? "Rule updated" : "Rule created");
      queryClient.invalidateQueries({ queryKey: ["tag-rules"] });
      handleCloseDialog();
    },
    onError: (error) => {
      toast.error(`Failed to save rule: ${error.message}`);
    },
  });

  // Delete rule
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("tag_rules")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Rule deleted");
      queryClient.invalidateQueries({ queryKey: ["tag-rules"] });
      setDeleteConfirmOpen(false);
      setRuleToDelete(null);
    },
    onError: (error) => {
      toast.error(`Failed to delete rule: ${error.message}`);
    },
  });

  // Apply rules to untagged calls
  const applyRulesMutation = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not authenticated");

      const { data, error } = await supabase.rpc("apply_tag_rules_to_untagged", {
        p_user_id: userData.user.id,
        p_dry_run: false,
        p_limit: 100,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      const results = Array.isArray(data) ? data : [];
      const count = results.length;
      // Count how many had tags vs folders assigned
      const tagCount = results.filter((r: { tag_name: string | null }) => r.tag_name).length;
      const folderCount = results.filter((r: { folder_name: string | null }) => r.folder_name).length;

      let message = `Applied rules to ${count} calls`;
      if (tagCount > 0 && folderCount > 0) {
        message += ` (${tagCount} tagged, ${folderCount} filed)`;
      } else if (tagCount > 0) {
        message += ` (${tagCount} tagged)`;
      } else if (folderCount > 0) {
        message += ` (${folderCount} filed)`;
      }
      toast.success(message);
      queryClient.invalidateQueries({ queryKey: ["tag-rules"] });
      queryClient.invalidateQueries({ queryKey: ["folder-assignments"] });
    },
    onError: (error) => {
      toast.error(`Failed to apply rules: ${error.message}`);
    },
  });

  const handleOpenCreate = () => {
    setEditingRule(null);
    setFormData({
      name: "",
      description: "",
      rule_type: "title_exact",
      tag_id: "",
      folder_id: "",
      priority: 100,
      conditions: {},
    });
    setDialogOpen(true);
  };

  const handleOpenEdit = (rule: Rule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      description: rule.description || "",
      rule_type: rule.rule_type,
      tag_id: rule.tag_id || "",
      folder_id: rule.folder_id || "",
      priority: rule.priority,
      conditions: rule.conditions || {},
    });
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingRule(null);
    setFormData({
      name: "",
      description: "",
      rule_type: "title_exact",
      tag_id: "",
      folder_id: "",
      priority: 100,
      conditions: {},
    });
  };

  const handleSubmit = () => {
    if (!formData.name) {
      toast.error("Please enter a rule name");
      return;
    }
    if (!formData.tag_id && !formData.folder_id) {
      toast.error("Please select at least a tag or folder to assign");
      return;
    }
    saveMutation.mutate(formData);
  };

  const getTagName = (tagId: string | null) => {
    if (!tagId) return null;
    return tags?.find((t) => t.id === tagId)?.name || "Unknown";
  };

  const getTagColor = (tagId: string | null) => {
    if (!tagId) return "#666";
    return tags?.find((t) => t.id === tagId)?.color || "#666";
  };

  const getFolderName = (folderId: string | null) => {
    if (!folderId) return null;
    return folders?.find((f) => f.id === folderId)?.name || "Unknown";
  };

  const getFolderColor = (folderId: string | null) => {
    if (!folderId) return "#666";
    return folders?.find((f) => f.id === folderId)?.color || "#666";
  };

  const renderConditionEditor = () => {
    switch (formData.rule_type) {
      case "title_exact": {
        return (
          <div className="space-y-2">
            <Label>Exact Title</Label>
            <Input
              value={formData.conditions.title || ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  conditions: { title: e.target.value },
                })
              }
              placeholder="Enter exact title to match"
            />
          </div>
        );
      }

      case "title_contains": {
        return (
          <div className="space-y-2">
            <Label>Contains Text</Label>
            <Input
              value={formData.conditions.contains || ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  conditions: { contains: e.target.value },
                })
              }
              placeholder="Text to search for in title"
            />
          </div>
        );
      }

      case "title_regex": {
        return (
          <div className="space-y-2">
            <Label>Regex Pattern</Label>
            <Input
              value={formData.conditions.pattern || ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  conditions: { pattern: e.target.value },
                })
              }
              placeholder="Regular expression pattern"
            />
          </div>
        );
      }

      case "transcript_keyword": {
        return (
          <div className="space-y-2">
            <Label>Keywords (comma-separated)</Label>
            <Textarea
              value={(formData.conditions.keywords || []).join(", ")}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  conditions: {
                    keywords: e.target.value.split(",").map((k) => k.trim()),
                    search_chars: 500,
                  },
                })
              }
              placeholder="onboarding, welcome, getting started"
            />
          </div>
        );
      }

      case "day_time": {
        return (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Day of Week</Label>
              <Select
                value={String(formData.conditions.day_of_week ?? "")}
                onValueChange={(v) =>
                  setFormData({
                    ...formData,
                    conditions: { ...formData.conditions, day_of_week: parseInt(v) },
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select day" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Sunday</SelectItem>
                  <SelectItem value="1">Monday</SelectItem>
                  <SelectItem value="2">Tuesday</SelectItem>
                  <SelectItem value="3">Wednesday</SelectItem>
                  <SelectItem value="4">Thursday</SelectItem>
                  <SelectItem value="5">Friday</SelectItem>
                  <SelectItem value="6">Saturday</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Hour (0-23)</Label>
              <Input
                type="number"
                min={0}
                max={23}
                value={formData.conditions.hour ?? ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    conditions: { ...formData.conditions, hour: parseInt(e.target.value) },
                  })
                }
                placeholder="Hour"
              />
            </div>
          </div>
        );
      }

      default:
        return null;
    }
  };

  if (rulesLoading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (rulesError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
          <RiFlowChart className="h-8 w-8 text-destructive/50" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Failed to load rules</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          There was an error loading your tag rules. Please try refreshing the page.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Action buttons */}
      <div className="flex items-center justify-between">
        <Button onClick={handleOpenCreate}>
          <RiAddLine className="h-4 w-4 mr-2" />
          Create Rule
        </Button>
        <Button
          variant="hollow"
          onClick={() => applyRulesMutation.mutate()}
          disabled={applyRulesMutation.isPending}
        >
          {applyRulesMutation.isPending ? (
            <RiLoader2Line className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RiPlayLine className="h-4 w-4 mr-2" />
          )}
          Apply Rules Now
        </Button>
      </div>

      {/* Rules table */}
      <div className="border border-border dark:border-cb-border-dark rounded-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-cb-white dark:bg-card hover:bg-cb-white dark:hover:bg-card">
              <TableHead className="font-medium text-xs uppercase tracking-wider w-12">
                Active
              </TableHead>
              <TableHead className="font-medium text-xs uppercase tracking-wider">
                Name
              </TableHead>
              <TableHead className="font-medium text-xs uppercase tracking-wider w-32">
                Type
              </TableHead>
              <TableHead className="font-medium text-xs uppercase tracking-wider w-32">
                Tag
              </TableHead>
              <TableHead className="font-medium text-xs uppercase tracking-wider w-32">
                Folder
              </TableHead>
              <TableHead className="font-medium text-xs uppercase tracking-wider w-20 text-right">
                Applied
              </TableHead>
              <TableHead className="font-medium text-xs uppercase tracking-wider w-32 text-right">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="p-0">
                  <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                    <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                      <RiFlowChart className="h-8 w-8 text-muted-foreground/50" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">No rules yet</h3>
                    <p className="text-sm text-muted-foreground max-w-sm mb-6">
                      Create rules to automatically assign tags and folders to incoming calls based on titles, keywords, or patterns.
                    </p>
                    <Button onClick={handleOpenCreate}>
                      <RiAddLine className="h-4 w-4 mr-2" />
                      Create Rule
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              rules?.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell>
                    <Switch
                      checked={rule.is_active ?? true}
                      onCheckedChange={(checked) =>
                        toggleRuleMutation.mutate({ id: rule.id, isActive: checked })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{rule.name}</div>
                      {rule.description && (
                        <div className="text-sm text-ink-muted">{rule.description}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {RULE_TYPES.find((t) => t.value === rule.rule_type)?.label || rule.rule_type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {rule.tag_id ? (
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-sm"
                          style={{ backgroundColor: getTagColor(rule.tag_id) }}
                        />
                        {getTagName(rule.tag_id)}
                      </div>
                    ) : (
                      <span className="text-ink-muted">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {rule.folder_id ? (
                      <div className="flex items-center gap-2">
                        <RiFolderLine
                          className="h-4 w-4"
                          style={{ color: getFolderColor(rule.folder_id) }}
                        />
                        {getFolderName(rule.folder_id)}
                      </div>
                    ) : (
                      <span className="text-ink-muted">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {rule.times_applied || 0}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(rule)}>
                        <RiEditLine className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setRuleToDelete(rule.id);
                          setDeleteConfirmOpen(true);
                        }}
                      >
                        <RiDeleteBinLine className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingRule ? "Edit Rule" : "Create Rule"}</DialogTitle>
            <DialogDescription>
              Define conditions for automatically assigning tags and/or folders to calls.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Rule Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="E.g., Team Meetings"
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Rule Type</Label>
                <Select
                  value={formData.rule_type}
                  onValueChange={(v) => setFormData({ ...formData, rule_type: v, conditions: {} })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RULE_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Priority</Label>
                <Input
                  type="number"
                  min={1}
                  max={1000}
                  value={formData.priority}
                  onChange={(e) =>
                    setFormData({ ...formData, priority: parseInt(e.target.value) || 100 })
                  }
                />
              </div>
            </div>

            {/* Actions Section - Tag and/or Folder assignment */}
            <div className="space-y-4 border-t pt-4">
              <Label className="text-sm font-medium">
                Actions (select at least one)
              </Label>

              {/* Tag Assignment (optional) */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Assign Tag</Label>
                <Select
                  value={formData.tag_id || "none"}
                  onValueChange={(v) => {
                    if (v === "__create_new_tag__") {
                      setInlineTagDialogOpen(true);
                    } else {
                      setFormData({ ...formData, tag_id: v === "none" ? "" : v });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="No tag (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__create_new_tag__">
                      <div className="flex items-center gap-2 text-primary">
                        <RiAddLine className="h-4 w-4" />
                        Create New Tag
                      </div>
                    </SelectItem>
                    <SelectItem value="none">No tag</SelectItem>
                    {tags?.map((tag) => (
                      <SelectItem key={tag.id} value={tag.id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-sm"
                            style={{ backgroundColor: tag.color || "#666" }}
                          />
                          {tag.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Folder Assignment (optional) */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Assign to Folder
                </Label>
                <Select
                  value={formData.folder_id || "none"}
                  onValueChange={(v) => {
                    if (v === "__create_new_folder__") {
                      setInlineFolderDialogOpen(true);
                    } else {
                      setFormData({ ...formData, folder_id: v === "none" ? "" : v });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="No folder (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__create_new_folder__">
                      <div className="flex items-center gap-2 text-primary">
                        <RiAddLine className="h-4 w-4" />
                        Create New Folder
                      </div>
                    </SelectItem>
                    <SelectItem value="none">No folder</SelectItem>
                    {folders?.map((folder) => (
                      <SelectItem key={folder.id} value={folder.id}>
                        <div className="flex items-center gap-2">
                          <RiFolderLine
                            className="h-4 w-4"
                            style={{ color: folder.color || "#666" }}
                          />
                          {folder.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {renderConditionEditor()}
          </div>

          <DialogFooter>
            <Button variant="hollow" onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={saveMutation.isPending}>
              {saveMutation.isPending && <RiLoader2Line className="h-4 w-4 mr-2 animate-spin" />}
              {editingRule ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Rule</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this rule? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="hollow" onClick={() => setDeleteConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => ruleToDelete && deleteMutation.mutate(ruleToDelete)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <RiLoader2Line className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Inline Tag Creation Dialog */}
      <QuickCreateTagDialog
        open={inlineTagDialogOpen}
        onOpenChange={setInlineTagDialogOpen}
        onTagCreated={(tagId) => {
          // Auto-select the newly created tag
          setFormData({ ...formData, tag_id: tagId });
          // Refresh tags list
          queryClient.invalidateQueries({ queryKey: ["call-tags"] });
        }}
      />

      {/* Inline Folder Creation Dialog */}
      <QuickCreateFolderDialog
        open={inlineFolderDialogOpen}
        onOpenChange={setInlineFolderDialogOpen}
        onFolderCreated={(folderId) => {
          // Auto-select the newly created folder
          setFormData({ ...formData, folder_id: folderId });
          // Refresh folders list
          queryClient.invalidateQueries({ queryKey: ["folders"] });
        }}
      />
    </div>
  );
}
