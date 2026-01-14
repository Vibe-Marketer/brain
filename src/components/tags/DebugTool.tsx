/**
 * Debug Tool for Sorting & Tagging (Admin Only)
 *
 * Provides diagnostic tools for testing rules, viewing tag statistics,
 * and debugging sorting/tagging functionality.
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  RiBugLine,
  RiPlayLine,
  RiRefreshLine,
  RiInformationLine,
  RiLoader2Line,
} from "@remixicon/react";

export function DebugTool() {
  const { isAdmin, loading: roleLoading } = useUserRole();
  const queryClient = useQueryClient();
  const [isExpanded, setIsExpanded] = useState(false);

  // Fetch debug statistics
  const { data: stats, isLoading: statsLoading, refetch } = useQuery({
    queryKey: ["debug-stats"],
    queryFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");

      // Get counts
      const [tagsResult, rulesResult, foldersResult, callsResult] = await Promise.all([
        supabase.from("call_tags").select("*", { count: "exact", head: true }),
        supabase.from("tag_rules").select("*", { count: "exact", head: true }),
        supabase.from("folders").select("*", { count: "exact", head: true }),
        supabase.from("fathom_calls").select("*", { count: "exact", head: true }).eq("user_id", user.user.id),
      ]);

      return {
        tags: tagsResult.count || 0,
        rules: rulesResult.count || 0,
        folders: foldersResult.count || 0,
        calls: callsResult.count || 0,
      };
    },
    enabled: isAdmin && !roleLoading,
  });

  // Test rules mutation
  const testRulesMutation = useMutation({
    mutationFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");

      const { data, error } = await supabase.rpc("apply_tag_rules_to_untagged", {
        p_user_id: user.user.id,
        p_dry_run: true,
        p_limit: 10,
      });

      if (error) throw error;
      return data || [];
    },
    onSuccess: (data) => {
      const results = Array.isArray(data) ? data : [];
      toast.success(`Dry run complete: ${results.length} calls would be tagged/filed`);
    },
    onError: (error) => {
      toast.error(`Test failed: ${error.message}`);
    },
  });

  // Clear cache mutation
  const clearCacheMutation = useMutation({
    mutationFn: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["call-tags"] }),
        queryClient.invalidateQueries({ queryKey: ["tag-rules"] }),
        queryClient.invalidateQueries({ queryKey: ["folders"] }),
        queryClient.invalidateQueries({ queryKey: ["tag-counts"] }),
        queryClient.invalidateQueries({ queryKey: ["folder-assignments"] }),
      ]);
    },
    onSuccess: () => {
      toast.success("Cache cleared successfully");
      refetch();
    },
  });

  // Don't render if not admin
  if (roleLoading) return null;
  if (!isAdmin) return null;

  return (
    <Card className="border-2 border-dashed border-vibe-orange/30 bg-vibe-orange/5 dark:bg-vibe-orange/10">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <RiBugLine className="h-5 w-5 text-vibe-orange" />
            <h3 className="text-sm font-semibold text-ink uppercase tracking-wide">
              Admin Debug Tool
            </h3>
            <Badge variant="outline" className="text-xs">
              Admin Only
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? "Collapse" : "Expand"}
          </Button>
        </div>

        {/* Stats Summary (Always Visible) */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          <div className="text-center p-2 bg-card rounded-lg border border-border">
            <div className="text-xs text-muted-foreground">Tags</div>
            <div className="text-lg font-semibold tabular-nums">
              {statsLoading ? "..." : stats?.tags || 0}
            </div>
          </div>
          <div className="text-center p-2 bg-card rounded-lg border border-border">
            <div className="text-xs text-muted-foreground">Rules</div>
            <div className="text-lg font-semibold tabular-nums">
              {statsLoading ? "..." : stats?.rules || 0}
            </div>
          </div>
          <div className="text-center p-2 bg-card rounded-lg border border-border">
            <div className="text-xs text-muted-foreground">Folders</div>
            <div className="text-lg font-semibold tabular-nums">
              {statsLoading ? "..." : stats?.folders || 0}
            </div>
          </div>
          <div className="text-center p-2 bg-card rounded-lg border border-border">
            <div className="text-xs text-muted-foreground">Calls</div>
            <div className="text-lg font-semibold tabular-nums">
              {statsLoading ? "..." : stats?.calls || 0}
            </div>
          </div>
        </div>

        {/* Expanded Actions */}
        {isExpanded && (
          <div className="space-y-3 pt-3 border-t border-border/50">
            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="hollow"
                size="sm"
                onClick={() => testRulesMutation.mutate()}
                disabled={testRulesMutation.isPending}
              >
                {testRulesMutation.isPending ? (
                  <RiLoader2Line className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RiPlayLine className="h-4 w-4 mr-2" />
                )}
                Test Rules (Dry Run)
              </Button>
              <Button
                variant="hollow"
                size="sm"
                onClick={() => clearCacheMutation.mutate()}
                disabled={clearCacheMutation.isPending}
              >
                {clearCacheMutation.isPending ? (
                  <RiLoader2Line className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RiRefreshLine className="h-4 w-4 mr-2" />
                )}
                Clear Cache
              </Button>
              <Button
                variant="hollow"
                size="sm"
                onClick={() => refetch()}
                disabled={statsLoading}
              >
                <RiRefreshLine className="h-4 w-4 mr-2" />
                Refresh Stats
              </Button>
            </div>

            {/* Info */}
            <div className="flex items-start gap-2 p-3 bg-muted/30 rounded-lg text-xs">
              <RiInformationLine className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
              <div className="text-muted-foreground">
                <p className="font-medium mb-1">Debug Tool Features:</p>
                <ul className="list-disc list-inside space-y-0.5 ml-1">
                  <li>View real-time statistics for tags, rules, folders, and calls</li>
                  <li>Test rule execution in dry-run mode (no changes made)</li>
                  <li>Clear query cache to force fresh data fetch</li>
                  <li>Monitor sorting & tagging system health</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
