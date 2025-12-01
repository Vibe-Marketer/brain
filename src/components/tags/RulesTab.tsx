import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
  RiLoader2Line,
  RiPlayLine,
} from "@remixicon/react";
import { format } from "date-fns";

interface Rule {
  id: string;
  name: string;
  description: string | null;
  rule_type: string;
  conditions: any;
  tag_id: string;
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

const RULE_TYPES = [
  { value: "title_exact", label: "Title Exact Match" },
  { value: "title_contains", label: "Title Contains" },
  { value: "title_regex", label: "Title Regex" },
  { value: "transcript_keyword", label: "Transcript Keywords" },
  { value: "day_time", label: "Day/Time" },
];

export function RulesTab() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    rule_type: "title_exact",
    tag_id: "",
    priority: 100,
    conditions: {} as any,
  });

  // Fetch rules
  const { data: rules, isLoading: rulesLoading } = useQuery({
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

  // Fetch tags
  const { data: tags } = useQuery({
    queryKey: ["call-tags"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("call_tags")
        .select("id, name, color")
        .order("name");

      if (error) throw error;
      return data as Tag[];
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

      if (editingRule) {
        const { error } = await supabase
          .from("tag_rules")
          .update({
            name: data.name,
            description: data.description || null,
            rule_type: data.rule_type,
            tag_id: data.tag_id,
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
          tag_id: data.tag_id,
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
      const count = Array.isArray(data) ? data.length : 0;
      toast.success(`Applied rules to ${count} calls`);
      queryClient.invalidateQueries({ queryKey: ["tag-rules"] });
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
      tag_id: rule.tag_id,
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
      priority: 100,
      conditions: {},
    });
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.tag_id) {
      toast.error("Please fill in required fields");
      return;
    }
    saveMutation.mutate(formData);
  };

  const getTagName = (tagId: string) => {
    return tags?.find((t) => t.id === tagId)?.name || "Unknown";
  };

  const getTagColor = (tagId: string) => {
    return tags?.find((t) => t.id === tagId)?.color || "#666";
  };

  const renderConditionEditor = () => {
    switch (formData.rule_type) {
      case "title_exact":
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

      case "title_contains":
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

      case "title_regex":
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

      case "transcript_keyword":
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

      case "day_time":
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
      <div className="border border-cb-border dark:border-cb-border-dark rounded-sm overflow-hidden">
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
                <TableCell colSpan={6} className="text-center py-8 text-cb-ink-muted">
                  No rules created yet. Create your first rule to get started.
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
                        <div className="text-sm text-cb-ink-muted">{rule.description}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {RULE_TYPES.find((t) => t.value === rule.rule_type)?.label || rule.rule_type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-sm"
                        style={{ backgroundColor: getTagColor(rule.tag_id) }}
                      />
                      {getTagName(rule.tag_id)}
                    </div>
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
              Define conditions for automatically tagging calls.
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

            <div className="space-y-2">
              <Label>Tag *</Label>
              <Select
                value={formData.tag_id}
                onValueChange={(v) => setFormData({ ...formData, tag_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select tag" />
                </SelectTrigger>
                <SelectContent>
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
    </div>
  );
}
