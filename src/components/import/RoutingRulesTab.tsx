/**
 * RoutingRulesTab — Rules tab content for the Import page.
 */

import { useState } from 'react';
import { toast } from 'sonner';
import { RiRouteLine, RiFlashlightLine, RiLoader2Line } from '@remixicon/react';
import { Button } from '@/components/ui/button';
import { useRoutingRules, useRoutingDefault, useReorderRules, useToggleRule, useBulkApplyRules } from '@/hooks/useRoutingRules';
import { usePanelStore } from '@/stores/panelStore';
import { useWorkspaces } from '@/hooks/useWorkspaces';
import { useOrgContextStore } from '@/stores/orgContextStore';
import { useOrganizations } from '@/hooks/useOrganizations';
import { DefaultDestinationBar } from './DefaultDestinationBar';
import { RoutingRulesList } from './RoutingRulesList';

function HelpContent() {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-semibold text-foreground">How routing works</p>
      <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
        <li>Rules are evaluated top-to-bottom in priority order</li>
        <li>The first matching rule wins — lower rules are skipped</li>
        <li>Calls that match no rule go to the default destination</li>
        <li>Rules only apply to newly imported calls — not historical data</li>
        <li>Drag rule cards to reorder their priority</li>
      </ul>
    </div>
  );
}

export function RoutingRulesTab() {
  const [showHelp, setShowHelp] = useState(false);

  const activeOrgId = useOrgContextStore((s) => s.activeOrgId);
  const { data: rules = [], isLoading: rulesLoading } = useRoutingRules();
  const { data: routingDefault } = useRoutingDefault();
  const reorderMutation = useReorderRules();
  const toggleMutation = useToggleRule();
  const { openPanel } = usePanelStore();

  const { workspaces = [] } = useWorkspaces(activeOrgId);
  const { data: allOrgs = [] } = useOrganizations();
  const bulkApply = useBulkApplyRules();
  const [bulkDryRunResult, setBulkDryRunResult] = useState<{ matched: number; matches: Array<{ rule_name: string }> } | null>(null);

  const workspaceNames: Record<string, string> = {};
  for (const ws of workspaces) {
    workspaceNames[ws.id] = ws.name;
  }

  const orgNames: Record<string, string> = {};
  for (const org of allOrgs) {
    orgNames[org.id] = org.name;
  }

  const folderNames: Record<string, string> = {};

  const hasDefault = !!routingDefault;
  const hasRules = rules.length > 0;

  function handleOpenCreate() {
    openPanel('routing-rule', { type: 'routing-rule', ruleId: null });
  }

  function handleEdit(id: string) {
    openPanel('routing-rule', { type: 'routing-rule', ruleId: id });
  }

  function handleToggle(id: string, enabled: boolean) {
    toggleMutation.mutate({ id, enabled });
  }

  function handleReorder(orderedIds: string[]) {
    reorderMutation.mutate(orderedIds);
  }

  async function handleBulkDryRun() {
    if (!activeOrgId) { toast.error('No organization selected'); return; }
    const result = await bulkApply.mutateAsync({ organizationId: activeOrgId, dryRun: true });
    setBulkDryRunResult({ matched: result.matched, matches: result.matches });
  }

  async function handleBulkApply() {
    if (!activeOrgId) { toast.error('No organization selected'); return; }
    await bulkApply.mutateAsync({ organizationId: activeOrgId, dryRun: false });
    setBulkDryRunResult(null);
  }

  if (rulesLoading) {
    return (
      <div className="space-y-4">
        <div className="h-16 rounded-xl border border-border/40 bg-muted/30 animate-pulse" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-xl border border-border/40 bg-muted/30 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DefaultDestinationBar />

      {hasRules && (
        <RoutingRulesList
          rules={rules}
          onReorder={handleReorder}
          onEdit={handleEdit}
          onToggle={handleToggle}
          workspaceNames={workspaceNames}
          folderNames={folderNames}
          orgNames={orgNames}
        />
      )}

      {hasRules && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              size="sm"
              onClick={handleOpenCreate}
              disabled={!hasDefault}
              title={!hasDefault ? 'Set a default destination above before creating rules' : undefined}
            >
              Create Rule
            </Button>
            {!hasDefault && (
              <p className="text-xs text-amber-500">
                Set a default destination above before creating rules
              </p>
            )}
          </div>

          {/* Bulk Apply section */}
          <div className="rounded-xl border border-border/50 bg-muted/20 p-4 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <RiFlashlightLine className="h-4 w-4 text-amber-500" />
                  Apply to existing calls
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Retroactively route historical calls to match your current rules. Calls already in a workspace are skipped.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  type="button"
                  variant="hollow"
                  size="sm"
                  onClick={handleBulkDryRun}
                  disabled={bulkApply.isPending}
                  className="text-xs"
                >
                  {bulkApply.isPending ? <RiLoader2Line className="h-3 w-3 animate-spin" /> : null}
                  Preview
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleBulkApply}
                  disabled={bulkApply.isPending}
                  className="text-xs"
                >
                  {bulkApply.isPending ? <RiLoader2Line className="h-3 w-3 animate-spin" /> : null}
                  Apply Now
                </Button>
              </div>
            </div>

            {/* Dry run result summary */}
            {bulkDryRunResult && (
              <div className="rounded-lg border border-amber-400/30 bg-amber-50/10 dark:bg-amber-900/10 p-3">
                {bulkDryRunResult.matched === 0 ? (
                  <p className="text-xs text-muted-foreground">No existing calls match your current rules.</p>
                ) : (
                  <>
                    <p className="text-xs font-semibold text-foreground mb-1.5">
                      Preview: {bulkDryRunResult.matched} call{bulkDryRunResult.matched !== 1 ? 's' : ''} would be routed
                    </p>
                    <div className="space-y-0.5 max-h-24 overflow-y-auto">
                      {bulkDryRunResult.matches.slice(0, 10).map((d, i) => (
                        <p key={i} className="text-[11px] text-muted-foreground truncate">
                          <span className="text-foreground/60">Rule:</span> {d.rule_name}
                        </p>
                      ))}
                      {bulkDryRunResult.matches.length > 10 && (
                        <p className="text-[11px] text-muted-foreground">+{bulkDryRunResult.matches.length - 10} more...</p>
                      )}
                    </div>
                    <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1.5">
                      Click "Apply Now" to confirm routing.
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {!hasRules && (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <RiRouteLine
            size={48}
            className="text-muted-foreground/30 mb-5"
            aria-hidden="true"
          />

          <h2 className="font-montserrat font-extrabold text-base uppercase tracking-wide text-foreground mb-2">
            Route new calls automatically
          </h2>

          <p className="text-sm text-muted-foreground max-w-sm mb-6">
            Send calls from each source to the right workspace and folder as soon as they're imported.
            No more dragging recordings around.
          </p>

          <Button
            type="button"
            onClick={handleOpenCreate}
            disabled={!hasDefault}
            title={!hasDefault ? 'Set a default destination above to get started' : undefined}
            className="mb-2"
          >
            Create your first rule
          </Button>

          {!hasDefault && (
            <p className="text-xs text-amber-500 mb-3">
              Set a default destination above to get started
            </p>
          )}

          <Button
            type="button"
            variant="link"
            onClick={() => setShowHelp((v) => !v)}
            className="text-xs"
          >
            Learn how routing works
          </Button>

          {showHelp && (
            <div className="mt-4 rounded-xl border border-border/60 bg-muted/30 p-4 text-left max-w-sm w-full">
              <HelpContent />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
