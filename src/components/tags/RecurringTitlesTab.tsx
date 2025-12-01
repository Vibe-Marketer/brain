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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { RiAddLine, RiCheckLine, RiLoader2Line } from "@remixicon/react";
import { format } from "date-fns";

interface RecurringTitle {
  title: string;
  occurrence_count: number;
  last_occurrence: string;
  first_occurrence: string;
  current_tags: string[] | null;
}

interface Tag {
  id: string;
  name: string;
  color: string | null;
  description: string | null;
}

export function RecurringTitlesTab() {
  const queryClient = useQueryClient();
  const [createRuleDialogOpen, setCreateRuleDialogOpen] = useState(false);
  const [selectedTitle, setSelectedTitle] = useState<string | null>(null);
  const [selectedTagId, setSelectedTagId] = useState<string>("");
  const [ruleName, setRuleName] = useState("");

  // Fetch recurring titles
  const { data: recurringTitles, isLoading: titlesLoading } = useQuery({
    queryKey: ["recurring-titles"],
    queryFn: async () => {
      // Query the view directly - it's already filtered by user via RLS
      const { data, error } = await supabase
        .from("fathom_calls")
        .select("title")
        .not("title", "is", null)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Group and count titles
      const titleCounts = (data || []).reduce((acc: Record<string, { count: number; lastDate: string; firstDate: string }>, call: any) => {
        const title = call.title;
        if (!acc[title]) {
          acc[title] = { count: 0, lastDate: call.created_at, firstDate: call.created_at };
        }
        acc[title].count++;
        return acc;
      }, {});

      // Convert to array and sort by count
      return Object.entries(titleCounts)
        .map(([title, data]) => ({
          title,
          occurrence_count: data.count,
          last_occurrence: data.lastDate,
          first_occurrence: data.firstDate,
          current_tags: null as string[] | null,
        }))
        .sort((a, b) => b.occurrence_count - a.occurrence_count)
        .slice(0, 50); // Top 50
    },
  });

  // Fetch tags
  const { data: tags, isLoading: tagsLoading } = useQuery({
    queryKey: ["call-tags"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("call_tags")
        .select("id, name, color, description")
        .order("name");

      if (error) throw error;
      return data as Tag[];
    },
  });

  // Fetch existing rules
  const { data: existingRules } = useQuery({
    queryKey: ["tag-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tag_rules")
        .select("*")
        .order("priority");

      if (error) throw error;
      return data;
    },
  });

  // Create rule mutation
  const createRuleMutation = useMutation({
    mutationFn: async ({ title, tagId, name }: { title: string; tagId: string; name: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not authenticated");

      const { error } = await supabase.from("tag_rules").insert({
        user_id: userData.user.id,
        name: name,
        rule_type: "title_exact",
        conditions: { title },
        tag_id: tagId,
        priority: 100,
        is_active: true,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tag rule created successfully");
      queryClient.invalidateQueries({ queryKey: ["tag-rules"] });
      setCreateRuleDialogOpen(false);
      setSelectedTitle(null);
      setSelectedTagId("");
      setRuleName("");
    },
    onError: (error) => {
      toast.error(`Failed to create rule: ${error.message}`);
    },
  });

  const handleCreateRule = (title: string) => {
    setSelectedTitle(title);
    setRuleName(`Auto: ${title.substring(0, 30)}${title.length > 30 ? "..." : ""}`);
    setCreateRuleDialogOpen(true);
  };

  const handleSubmitRule = () => {
    if (!selectedTitle || !selectedTagId || !ruleName) {
      toast.error("Please fill in all fields");
      return;
    }
    createRuleMutation.mutate({
      title: selectedTitle,
      tagId: selectedTagId,
      name: ruleName,
    });
  };

  // Check if a rule already exists for a title
  const hasRuleForTitle = (title: string) => {
    return existingRules?.some(
      (rule) => rule.rule_type === "title_exact" && (rule.conditions as any)?.title === title
    );
  };

  if (titlesLoading) {
    return (
      <div className="space-y-4">
        {[...Array(10)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="border border-cb-border dark:border-cb-border-dark rounded-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-cb-white dark:bg-card hover:bg-cb-white dark:hover:bg-card">
              <TableHead className="font-medium text-xs uppercase tracking-wider">
                Title
              </TableHead>
              <TableHead className="font-medium text-xs uppercase tracking-wider w-24 text-right">
                Count
              </TableHead>
              <TableHead className="font-medium text-xs uppercase tracking-wider w-32">
                Last Seen
              </TableHead>
              <TableHead className="font-medium text-xs uppercase tracking-wider w-40">
                Status
              </TableHead>
              <TableHead className="font-medium text-xs uppercase tracking-wider w-32 text-right">
                Action
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recurringTitles?.map((item) => {
              const hasRule = hasRuleForTitle(item.title);
              return (
                <TableRow key={item.title}>
                  <TableCell className="font-medium">{item.title}</TableCell>
                  <TableCell className="text-right tabular-nums">{item.occurrence_count}</TableCell>
                  <TableCell className="text-cb-ink-muted">
                    {item.last_occurrence
                      ? format(new Date(item.last_occurrence), "MMM d, yyyy")
                      : "-"}
                  </TableCell>
                  <TableCell>
                    {hasRule ? (
                      <Badge variant="outline" className="text-green-600 border-green-600">
                        <RiCheckLine className="h-3 w-3 mr-1" />
                        Has Rule
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-cb-ink-muted">
                        No Rule
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="hollow"
                      size="sm"
                      onClick={() => handleCreateRule(item.title)}
                      disabled={hasRule}
                    >
                      <RiAddLine className="h-4 w-4 mr-1" />
                      {hasRule ? "Exists" : "Create Rule"}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Create Tag Rule Dialog */}
      <Dialog open={createRuleDialogOpen} onOpenChange={setCreateRuleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Tag Rule</DialogTitle>
            <DialogDescription>
              Automatically tag calls with this exact title.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Title Pattern</Label>
              <Input value={selectedTitle || ""} disabled className="bg-muted" />
            </div>

            <div className="space-y-2">
              <Label>Rule Name</Label>
              <Input
                value={ruleName}
                onChange={(e) => setRuleName(e.target.value)}
                placeholder="Enter a name for this rule"
              />
            </div>

            <div className="space-y-2">
              <Label>Tag</Label>
              <Select value={selectedTagId} onValueChange={setSelectedTagId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a tag" />
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
          </div>

          <DialogFooter>
            <Button variant="hollow" onClick={() => setCreateRuleDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmitRule}
              disabled={createRuleMutation.isPending || !selectedTagId || !ruleName}
            >
              {createRuleMutation.isPending && (
                <RiLoader2Line className="h-4 w-4 mr-2 animate-spin" />
              )}
              Create Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
