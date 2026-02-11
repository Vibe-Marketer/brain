import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { RiCloseLine, RiFlashlightLine, RiPlayCircleLine, RiTimeLine, RiWebhookLine } from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePanelStore } from "@/stores/panelStore";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";

interface AutomationRulePanelProps {
  ruleId: string;
}

const triggerLabelMap: Record<string, string> = {
  call_created: "Call Created",
  transcript_phrase: "Phrase Match",
  sentiment: "Sentiment",
  duration: "Duration",
  webhook: "Webhook",
  scheduled: "Scheduled",
};

export function AutomationRulePanel({ ruleId }: AutomationRulePanelProps) {
  const { user } = useAuth();
  const { closePanel } = usePanelStore();

  const { data: rule, isLoading } = useQuery({
    queryKey: ["automation-rule", "panel", ruleId, user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("automation_rules")
        .select("id,name,description,enabled,trigger_type,actions,times_applied,last_applied_at,updated_at")
        .eq("id", ruleId)
        .eq("user_id", user.id)
        .single();
      if (error) {
        logger.error("Failed to load automation rule panel", error);
        throw error;
      }
      return data;
    },
    enabled: !!user?.id && !!ruleId,
  });

  const actionCount = useMemo(() => {
    if (!rule?.actions) return 0;
    return Array.isArray(rule.actions) ? rule.actions.length : 0;
  }, [rule?.actions]);

  if (isLoading) {
    return (
      <div className="h-full flex flex-col">
        <header className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">Rule Details</h3>
          <Button variant="ghost" size="sm" onClick={closePanel} aria-label="Close panel">
            <RiCloseLine className="h-4 w-4" />
          </Button>
        </header>
        <div className="p-4 text-sm text-muted-foreground">Loading rule details...</div>
      </div>
    );
  }

  if (!rule) {
    return (
      <div className="h-full flex flex-col">
        <header className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">Rule Details</h3>
          <Button variant="ghost" size="sm" onClick={closePanel} aria-label="Close panel">
            <RiCloseLine className="h-4 w-4" />
          </Button>
        </header>
        <div className="p-4 text-sm text-muted-foreground">Rule not found.</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide truncate">{rule.name}</h3>
          <p className="text-xs text-muted-foreground">Rule detail panel</p>
        </div>
        <Button variant="ghost" size="sm" onClick={closePanel} aria-label="Close panel">
          <RiCloseLine className="h-4 w-4" />
        </Button>
      </header>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className={cn(rule.enabled ? "bg-success-bg text-success-text" : "bg-neutral-bg text-neutral-text")}>
            {rule.enabled ? <RiPlayCircleLine className="h-3.5 w-3.5 mr-1" /> : <RiFlashlightLine className="h-3.5 w-3.5 mr-1" />}
            {rule.enabled ? "Active" : "Inactive"}
          </Badge>
          <Badge variant="secondary" className="bg-info-bg text-info-text">
            <RiWebhookLine className="h-3.5 w-3.5 mr-1" />
            {triggerLabelMap[rule.trigger_type] ?? "Unknown Trigger"}
          </Badge>
        </div>

        {rule.description && (
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Description</p>
            <p className="text-sm text-foreground">{rule.description}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Runs</p>
            <p className="text-lg font-semibold tabular-nums text-foreground">{rule.times_applied.toLocaleString()}</p>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Actions</p>
            <p className="text-lg font-semibold tabular-nums text-foreground">{actionCount}</p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide">
            <RiTimeLine className="h-3.5 w-3.5" /> Last Run
          </div>
          <p className="text-sm text-foreground">{rule.last_applied_at ? new Date(rule.last_applied_at).toLocaleString() : "Never"}</p>
          <p className="text-xs text-muted-foreground">Updated {new Date(rule.updated_at).toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}
