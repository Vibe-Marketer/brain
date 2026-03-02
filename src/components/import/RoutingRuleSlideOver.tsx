/**
 * RoutingRuleSlideOver — Fixed-position rule editor panel that floats over the rule list.
 */

import { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { RiCloseLine, RiInformationLine } from '@remixicon/react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useRoutingRuleStore } from '@/stores/routingRuleStore';
import { useRoutingRules, useCreateRule, useUpdateRule } from '@/hooks/useRoutingRules';
import { useRulePreview, useOverlapCheck } from '@/hooks/useRulePreview';
import { useOrgContextStore } from '@/stores/orgContextStore';
import { RoutingConditionBuilder } from './RoutingConditionBuilder';
import { DestinationPicker } from './DestinationPicker';
import { RulePreviewCount } from './RulePreviewCount';
import type { RoutingCondition, RoutingDestination } from '@/types/routing';

const SPRING = { type: 'spring', damping: 30, stiffness: 300 } as const;

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

export function RoutingRuleSlideOver() {
  const { isSlideOverOpen, activeRuleId, closeSlideOver } = useRoutingRuleStore();
  const activeOrgId = useOrgContextStore((s) => s.activeOrgId);
  const { data: allRules = [] } = useRoutingRules();
  const createRule = useCreateRule();
  const updateRule = useUpdateRule();

  const [form, setForm] = useState<RuleFormState>({
    name: '',
    conditions: [DEFAULT_CONDITION],
    logicOperator: 'AND',
    destination: null,
  });

  const initializeForm = useCallback(() => {
    if (!isSlideOverOpen) return;

    if (activeRuleId === null) {
      const isFirstRule = allRules.length === 0;
      setForm({
        name: '',
        conditions: [isFirstRule ? FIRST_RULE_SUGGESTION : DEFAULT_CONDITION],
        logicOperator: 'AND',
        destination: null,
      });
    } else {
      const existingRule = allRules.find((r) => r.id === activeRuleId);
      if (existingRule) {
        setForm({
          name: existingRule.name,
          conditions:
            existingRule.conditions.length > 0
              ? existingRule.conditions
              : [DEFAULT_CONDITION],
          logicOperator: existingRule.logic_operator,
          destination: {
            vaultId: existingRule.target_vault_id,
            folderId: existingRule.target_folder_id,
          },
        });
      }
    }
  }, [isSlideOverOpen, activeRuleId, allRules]);

  useEffect(() => {
    initializeForm();
  }, [initializeForm]);

  const preview = useRulePreview(form.conditions, form.logicOperator);
  const overlapInfo = useOverlapCheck(form.conditions, form.logicOperator, activeRuleId);

  const canSave =
    form.name.trim().length > 0 &&
    form.conditions.length > 0 &&
    form.destination !== null &&
    !createRule.isPending &&
    !updateRule.isPending;

  async function handleSave() {
    if (!canSave || !form.destination) return;

    const payload = {
      bank_id: activeOrgId!,
      name: form.name.trim(),
      conditions: form.conditions,
      logic_operator: form.logicOperator,
      target_vault_id: form.destination.vaultId,
      target_folder_id: form.destination.folderId,
      enabled: true,
    };

    if (activeRuleId === null) {
      createRule.mutate(payload, {
        onSuccess: () => {
          toast.success('Rule created');
          closeSlideOver();
        },
      });
    } else {
      updateRule.mutate(
        { id: activeRuleId, updates: payload },
        {
          onSuccess: () => {
            toast.success('Rule updated');
            closeSlideOver();
          },
        }
      );
    }
  }

  const isEditMode = activeRuleId !== null;
  const isSaving = createRule.isPending || updateRule.isPending;

  return (
    <AnimatePresence>
      {isSlideOverOpen && (
        <>
          <motion.div
            key="slide-over-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.3 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={closeSlideOver}
            className="fixed inset-0 z-40 bg-black"
            aria-hidden="true"
          />

          <motion.aside
            key="slide-over-panel"
            role="dialog"
            aria-modal="true"
            aria-label={isEditMode ? 'Edit routing rule' : 'Create routing rule'}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={SPRING}
            className={cn(
              'fixed right-0 top-0 bottom-0 z-50',
              'w-full sm:w-[480px]',
              'bg-card border-l border-border shadow-2xl',
              'flex flex-col overflow-hidden'
            )}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
              <h2 className="text-base font-semibold text-foreground">
                {isEditMode ? 'Edit Rule' : 'Create Rule'}
              </h2>
              <button
                type="button"
                onClick={closeSlideOver}
                aria-label="Close"
                className={cn(
                  'flex items-center justify-center w-8 h-8 rounded-md',
                  'text-muted-foreground hover:text-foreground hover:bg-muted',
                  'transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                )}
              >
                <RiCloseLine className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
              <div className="flex items-start gap-2 rounded-lg border border-border/50 bg-muted/40 px-3 py-2.5">
                <RiInformationLine className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground">
                  Rules apply to new imports only. Existing calls are not re-routed.
                </p>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="rule-name"
                  className="block text-sm font-medium text-foreground"
                >
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

              <div className="space-y-1.5">
                <p className="text-sm font-medium text-foreground">Preview</p>
                <RulePreviewCount
                  matchingCount={preview.matchingCount}
                  matchingCalls={preview.matchingCalls}
                  totalChecked={preview.totalChecked}
                  overlapInfo={overlapInfo}
                  isLoading={preview.isLoading}
                />
              </div>
            </div>

            <div className="shrink-0 flex items-center justify-end gap-3 px-5 py-4 border-t border-border">
              <button
                type="button"
                onClick={closeSlideOver}
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
                  'text-sm font-medium text-white',
                  'bg-brand-500 hover:bg-brand-600 transition-colors',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                {isSaving
                  ? isEditMode
                    ? 'Saving…'
                    : 'Creating…'
                  : isEditMode
                  ? 'Save changes'
                  : 'Create rule'}
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
