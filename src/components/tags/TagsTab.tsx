import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { usePanelStore } from "@/stores/panelStore";

interface Tag {
  id: string;
  name: string;
  color: string | null;
  description: string | null;
  is_system: boolean | null;
}

export function TagsTab() {
  const { openPanel, panelData, panelType } = usePanelStore();

  // Track selected tag for visual highlighting
  const selectedTagId = panelType === 'tag-detail' ? panelData?.tagId : null;

  const handleTagClick = (tag: Tag) => {
    openPanel('tag-detail', { tagId: tag.id });
  };

  // Fetch tags
  const { data: tags, isLoading } = useQuery({
    queryKey: ["call-tags"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("call_tags")
        .select("id, name, color, description, is_system")
        .order("name");

      if (error) throw error;
      return data as Tag[];
    },
  });

  // Fetch tag usage counts
  const { data: tagCounts } = useQuery({
    queryKey: ["tag-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("call_tag_assignments")
        .select("tag_id");

      if (error) throw error;

      // Count by tag
      const counts: Record<string, number> = {};
      (data || []).forEach((assignment) => {
        counts[assignment.tag_id] = (counts[assignment.tag_id] || 0) + 1;
      });
      return counts;
    },
  });

  if (isLoading) {
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
      <p className="text-sm text-cb-ink-muted">
        These are the system-wide tags that classify calls by type. Tags control which AI prompts
        and analysis run on each call.
      </p>

      <div className="border border-cb-border dark:border-cb-border-dark rounded-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-cb-white dark:bg-card hover:bg-cb-white dark:hover:bg-card">
              <TableHead className="font-medium text-xs uppercase tracking-wider w-12">
                Color
              </TableHead>
              <TableHead className="font-medium text-xs uppercase tracking-wider">
                Name
              </TableHead>
              <TableHead className="font-medium text-xs uppercase tracking-wider">
                Description
              </TableHead>
              <TableHead className="font-medium text-xs uppercase tracking-wider w-24">
                Type
              </TableHead>
              <TableHead className="font-medium text-xs uppercase tracking-wider w-20 text-right">
                Calls
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tags?.map((tag) => {
              const isSelected = selectedTagId === tag.id;
              return (
                <TableRow
                  key={tag.id}
                  className={`cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-cb-hover dark:bg-cb-hover-dark"
                      : "hover:bg-cb-hover/50 dark:hover:bg-cb-hover-dark/50"
                  }`}
                  onClick={() => handleTagClick(tag)}
                >
                  <TableCell>
                    <div
                      className="w-6 h-6 rounded-sm"
                      style={{ backgroundColor: tag.color || "#666" }}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{tag.name}</TableCell>
                  <TableCell className="text-cb-ink-muted">
                    {tag.description || "-"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={tag.is_system ? "secondary" : "outline"}>
                      {tag.is_system ? "System" : "Custom"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {tagCounts?.[tag.id] || 0}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
