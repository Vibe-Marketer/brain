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

interface Category {
  id: string;
  name: string;
  color: string | null;
  description: string | null;
  is_system: boolean | null;
}

export function CategoriesTab() {
  // Fetch categories
  const { data: categories, isLoading } = useQuery({
    queryKey: ["call-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("call_categories")
        .select("id, name, color, description, is_system")
        .order("name");

      if (error) throw error;
      return data as Category[];
    },
  });

  // Fetch category usage counts
  const { data: categoryCounts } = useQuery({
    queryKey: ["category-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("call_category_assignments")
        .select("category_id");

      if (error) throw error;

      // Count by category
      const counts: Record<string, number> = {};
      (data || []).forEach((assignment) => {
        counts[assignment.category_id] = (counts[assignment.category_id] || 0) + 1;
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
        These are the system-wide categories available for all calls. Categories are assigned via
        rules or AI-generated suggestions.
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
            {categories?.map((category) => (
              <TableRow key={category.id}>
                <TableCell>
                  <div
                    className="w-6 h-6 rounded-sm"
                    style={{ backgroundColor: category.color || "#666" }}
                  />
                </TableCell>
                <TableCell className="font-medium">{category.name}</TableCell>
                <TableCell className="text-cb-ink-muted">
                  {category.description || "-"}
                </TableCell>
                <TableCell>
                  <Badge variant={category.is_system ? "secondary" : "outline"}>
                    {category.is_system ? "System" : "Custom"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {categoryCounts?.[category.id] || 0}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
