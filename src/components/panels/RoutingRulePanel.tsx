import { useState, useEffect, useCallback } from 'react';
import { RiCloseLine, RiInformationLine, RiFlashlightLine, RiLoader2Line } from '@remixicon/react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { usePanelStore } from '@/stores/panelStore';
import { useRoutingRules, useCreateRule, useUpdateRule } from '@/hooks/useRoutingRules';
import { useRulePreview, useOverlapCheck } from '@/hooks/useRulePreview';
import { useBulkApplyRules } from '@/hooks/useBulkApplyRules';
import { useOrgContextStore } from '@/stores/orgContextStore';
import { RoutingConditionBuilder } from '@/components/import/RoutingConditionBuilder';
import { DestinationPicker } from '@/components/import/DestinationPicker';
import { RulePreviewCount } from '@/components/import/RulePreviewCount';
import type { RoutingCondition, RoutingDestination } from '@/types/routing';
import { Button } from '@/components/ui/button';

const DEFAULT_CONDITION: RoutingCondition = {
  field: 'title',
  operator: 'contains',
  value: '',
};

const FIRST_RULE_SUGGESTION: RoutingCondition = {
  field: 'source',
  operator: 'equals',
  value: 'fathom',
};

interface RuleFormState {
  name: string;
  conditions: RoutingCondition[];
  logicOperator: 'AND' | 'OR';
  destination: RoutingDestination | null;
}

export function RoutingRulePanel({ ruleId }: { ruleId: string | null }) {
  const { closePanel } = usePanelStore();
  const activeOrgId = useOrgContextStore((s) => s.activeOrgId);
  const { data: allRules = [] } = useRoutingRules();
  const createRule = useCreateRule();
  const updateRule = useUpdateRule();
  const bulkApply = useBulkApplyRules();

  const [form, setForm] = useState<RuleFormState>({
    name: '',
    conditions: [DEFAULT_CONDITION],
    logicOperator: 'AND',
    destination: null,
  });

  const initializeForm = useCallback(() => {
    if (ruleId === null) {
      const isFirstRule = allRules.length === 0;
      setForm({
        name: '',
        conditions: [isFirstRule ? FIRST_RULE_SUGGESTION : DEFAULT_CONDITION],
        logicOperator: 'AND',
        destination: null,
      });
    } else {
      const existingRule = allRules.find((r) => r.id === ruleId);
      if (existingRule) {
        setForm({
          name: existingRule.name,
          conditions:
            existingRule.conditions.length > 0
              ? existingRule.conditions
              : [DEFAULT_CONDITION],
          logicOperator: existingRule.logic_operator,
          destination: {
            workspaceId: existingRule.target_workspace_id,
            folderId: existingRule.target_folder_id,
          },
        });
      }
    }
  }, [ruleId, allRules]);

  useEffect(() => {
    initializeForm();
  }, [initializeForm]);

  const preview = useRulePreview(form.conditions, form.logicOperator);
  const overlapInfo = useOverlapCheck(form.conditions, form.logicOperator, ruleId);

  const canSave =
    form.name.trim().length > 0 &&
    form.conditions.length > 0 &&
    form.destination !== null &&
    !createRule.isPending &&
    !updateRule.isPending;

  async function handleSave() {
    if (!canSave || !form.destination) return;

    const payload = {
      name: form.name.trim(),
      conditions: form.conditions,
      logic_operator: form.logicOperator,
      target_workspace_id: form.destination.workspaceId,
      target_folder_id: form.destination.folderId,
      enabled: true,
    };

    if (ruleId === null) {
      createRule.mutate(payload, {
        onSuccess: () => {
          toast.success('Rule created');
          closePanel();
        },
      });
    } else {
      updateRule.mutate(
        { id: ruleId, updates: payload },
        {
          onSuccess: () => {
            toast.success('Rule updated');
            closePanel();
          },
        }
      );
    }
  }

  const isEditMode = ruleId !== null;
  const isSaving = createRule.isPending || updateRule.isPending;

  return (
    <div className="h-full flex flex-col overflow-hidden bg-card">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide truncate">
            {isEditMode ? 'Edit Rule' : 'Create Rule'}
          </h3>
          <p className="text-xs text-muted-foreground">Routing rule</p>
        </div>
        <Button variant="ghost" size="sm" onClick={closePanel} aria-label="Close panel">
          <RiCloseLine className="h-4 w-4" />
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
        <div className="flex items-start gap-2 rounded-lg border border-border/50 bg-muted/40 px-3 py-2.5">
          <RiInformationLine className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground">
            Rules automatically apply to new imports. To route existing historical calls, click "Apply to existing calls" below after saving.
          </p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="rule-name" className="block text-sm font-medium text-foreground">
            Rule name
          </label>
          <input
            id="rule-name"
            type="text"
            value={form.name}
            onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
            placeholder="e.g., Q1 Reviews, Acme Meetings"
            required
            className={cn(
              'w-full h-9 rounded-md border border-border bg-background px-3 py-1',
              'text-sm text-foreground placeholder:text-muted-foreground',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0'
            )}
          />
        </div>

        <div className="space-y-1.5">
          <p className="text-sm font-medium text-foreground">Conditions</p>
          <RoutingConditionBuilder
            conditions={form.conditions}
            logicOperator={form.logicOperator}
            onConditionsChange={(c) => setForm(p => ({ ...p, conditions: c }))}
            onLogicOperatorChange={(o) => setForm(p => ({ ...p, logicOperator: o }))}
          />
        </div>

        {activeOrgId && (
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">
              Route matching calls to:
            </label>
            <DestinationPicker
              value={form.destination}
              onChange={(d) => setForm(p => ({ ...p, destination: d }))}
              orgId={activeOrgId}
            />
          </div>
        )}

        <div className="space-y-1.5 pb-2">
          <p className="text-sm font-medium text-foreground">Preview</p>
          <RulePreviewCount
            matchingCount={preview.matchingCount}
            matchingCalls={preview.matchingCalls}
            totalChecked={preview.totalChecked}
            overlapInfo={overlapInfo}
            isLoading={preview.isLoading}
          />
        </div>

        {isEditMode && (
          <div className="rounded-xl border border-border/50 bg-muted/20 p-4 space-y-3 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <RiFlashlightLine className="h-4 w-4 text-amber-500" />
                  Apply to existing calls
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 max-w-sm">
                  Retroactively route historical calls to match your current rule. Calls already in a workspace are skipped.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => bulkApply.mutate({ ruleIds: [ruleId!], dryRun: false })}
                  disabled={bulkApply.isPending || isSaving}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-xs font-semibold',
                    'bg-foreground text-background',
                    'hover:bg-foreground/90 transition-colors',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    'disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5',
                  )}
                >
                  {bulkApply.isPending ? <RiLoader2Line className="h-3 w-3 animate-spin" /> : null}
                  Apply Now
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="shrink-0 flex items-center justify-end gap-3 px-5 py-4 border-t border-border">
          <button
            type="button"
            onClick={closePanel}
            disabled={isSaving}
            className={cn(
              'h-9 px-4 rounded-md border border-border bg-transparent',
              'text-sm font-medium text-foreground',
              'hover:bg-muted transition-colors',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className={cn(
              'h-9 px-4 rounded-md',
              'text-sm font-medium',
              'bg-foreground text-background',
              'hover:bg-foreground/90 transition-colors',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {isSaving
              ? isEditMode
                ? 'Saving...'
                : 'Creating...'
              : isEditMode
              ? 'Save changes'
              : 'Create rule'}
          </button>
      </div>
    </div>
  );
}
