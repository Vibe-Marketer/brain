/**
 * useRoutingRules — TanStack Query hooks for import routing rule management.
 * Column names match post-Phase-16 DB rename: bank_id→organization_id, vault_id→workspace_id.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/query-config';
import { useOrgContextStore } from '@/stores/orgContextStore';
import { useAuth } from '@/contexts/AuthContext';
import type { RoutingRule, RoutingDefault, BulkApplyResult } from '@/types/routing';

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Fetches all routing rules for the active organization.
 */
export function useRoutingRules() {
  const { user } = useAuth();
  const activeOrgId = useOrgContextStore((s) => s.activeOrgId);

  return useQuery<RoutingRule[]>({
    queryKey: queryKeys.routingRules.list(activeOrgId ?? undefined),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('import_routing_rules')
        .select('*')
        .eq('organization_id', activeOrgId!)
        .order('priority', { ascending: true });

      if (error) {
        throw new Error(`Failed to fetch routing rules: ${error.message}`);
      }

      return (data ?? []) as unknown as RoutingRule[];
    },
    enabled: !!user && !!activeOrgId,
  });
}

/**
 * Fetches the default routing destination for the active organization.
 */
export function useRoutingDefault() {
  const { user } = useAuth();
  const activeOrgId = useOrgContextStore((s) => s.activeOrgId);

  return useQuery<RoutingDefault | null>({
    queryKey: queryKeys.routingRules.defaults(activeOrgId ?? undefined),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('import_routing_defaults')
        .select('*')
        .eq('organization_id', activeOrgId!)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to fetch routing default: ${error.message}`);
      }

      return data as RoutingDefault | null;
    },
    enabled: !!user && !!activeOrgId,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Creates a new routing rule for the active organization.
 */
export function useCreateRule() {
  const queryClient = useQueryClient();
  const activeOrgId = useOrgContextStore((s) => s.activeOrgId);
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: {
      name: string;
      conditions: RoutingRule['conditions'];
      logic_operator: 'AND' | 'OR';
      target_workspace_id: string;
      target_folder_id: string | null;
      enabled: boolean;
    }) => {
      if (!activeOrgId) throw new Error('No active organization');
      if (!user) throw new Error('Must be authenticated to create a routing rule');

      // Compute next priority (MAX + 1)
      const { data: existing } = await supabase
        .from('import_routing_rules')
        .select('priority')
        .eq('organization_id', activeOrgId)
        .order('priority', { ascending: false })
        .limit(1);

      const maxPriority = existing?.[0]?.priority ?? 0;
      const nextPriority = maxPriority + 1;

      const { data, error } = await supabase
        .from('import_routing_rules')
        .insert({
          organization_id: activeOrgId,
          created_by: user.id,
          priority: nextPriority,
          ...input,
          conditions: input.conditions as unknown as import('@/integrations/supabase/types').Json,
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create routing rule: ${error.message}`);
      }

      return data as unknown as RoutingRule;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.routingRules.list(activeOrgId ?? undefined),
      });
      toast.success('Routing rule created');
    },
    onError: (error: Error) => {
      toast.error(error.message ?? 'Failed to create routing rule');
    },
  });
}

/**
 * Updates an existing routing rule by ID.
 */
export function useUpdateRule() {
  const queryClient = useQueryClient();
  const activeOrgId = useOrgContextStore((s) => s.activeOrgId);

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<
        Pick<
          RoutingRule,
          'name' | 'conditions' | 'logic_operator' | 'target_workspace_id' | 'target_folder_id' | 'enabled'
        >
      >;
    }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updatePayload: any = {
        ...updates,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('import_routing_rules')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update routing rule: ${error.message}`);
      }

      return data as unknown as RoutingRule;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.routingRules.list(activeOrgId ?? undefined),
      });
    },
    onError: (error: Error) => {
      toast.error(error.message ?? 'Failed to update routing rule');
    },
  });
}

/**
 * Deletes a routing rule by ID.
 */
export function useDeleteRule() {
  const queryClient = useQueryClient();
  const activeOrgId = useOrgContextStore((s) => s.activeOrgId);

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('import_routing_rules')
        .delete()
        .eq('id', id);

      if (error) {
        throw new Error(`Failed to delete routing rule: ${error.message}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.routingRules.list(activeOrgId ?? undefined),
      });
      toast.success('Routing rule deleted');
    },
    onError: (error: Error) => {
      toast.error(error.message ?? 'Failed to delete routing rule');
    },
  });
}

/**
 * Toggles a routing rule's enabled/disabled state (optimistic update).
 */
export function useToggleRule() {
  const queryClient = useQueryClient();
  const activeOrgId = useOrgContextStore((s) => s.activeOrgId);

  return useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { data, error } = await supabase
        .from('import_routing_rules')
        .update({ enabled, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to toggle routing rule: ${error.message}`);
      }

      return data as unknown as RoutingRule;
    },
    onMutate: async ({ id, enabled }) => {
      const queryKey = queryKeys.routingRules.list(activeOrgId ?? undefined);
      await queryClient.cancelQueries({ queryKey });
      const previousRules = queryClient.getQueryData<RoutingRule[]>(queryKey);

      queryClient.setQueryData<RoutingRule[]>(queryKey, (old) =>
        (old ?? []).map((rule) =>
          rule.id === id ? { ...rule, enabled } : rule
        )
      );

      return { previousRules, queryKey };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousRules !== undefined && context?.queryKey) {
        queryClient.setQueryData(context.queryKey, context.previousRules);
      }
      toast.error('Failed to update rule');
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.routingRules.list(activeOrgId ?? undefined),
      });
    },
  });
}

/**
 * Reorders routing rules by calling the RPC with new priority order.
 */
export function useReorderRules() {
  const queryClient = useQueryClient();
  const activeOrgId = useOrgContextStore((s) => s.activeOrgId);

  return useMutation({
    mutationFn: async (orderedIds: string[]) => {
      if (!activeOrgId) throw new Error('No active organization');

      const { error } = await supabase.rpc('update_routing_rule_priorities', {
        p_organization_id: activeOrgId,
        p_rule_ids: orderedIds,
      });

      if (error) {
        throw new Error(`Failed to reorder routing rules: ${error.message}`);
      }
    },
    onMutate: async (orderedIds) => {
      const queryKey = queryKeys.routingRules.list(activeOrgId ?? undefined);
      await queryClient.cancelQueries({ queryKey });
      const previousRules = queryClient.getQueryData<RoutingRule[]>(queryKey);

      queryClient.setQueryData<RoutingRule[]>(queryKey, (old) => {
        if (!old) return old;
        const ruleMap = new Map(old.map((r) => [r.id, r]));
        return orderedIds
          .map((id, index) => {
            const rule = ruleMap.get(id);
            return rule ? { ...rule, priority: index + 1 } : null;
          })
          .filter((r): r is RoutingRule => r !== null);
      });

      return { previousRules, queryKey };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousRules !== undefined && context?.queryKey) {
        queryClient.setQueryData(context.queryKey, context.previousRules);
      }
      toast.error('Failed to reorder rules. Please try again.');
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.routingRules.list(activeOrgId ?? undefined),
      });
    },
  });
}

/**
 * Bulk apply routing rules to existing recordings (dry run or execute).
 */
export function useBulkApplyRules() {
  const queryClient = useQueryClient();
  const activeOrgId = useOrgContextStore((s) => s.activeOrgId);

  return useMutation({
    mutationFn: async ({ dryRun }: { dryRun: boolean }): Promise<BulkApplyResult> => {
      if (!activeOrgId) throw new Error('No active organization');

      const { data, error } = await supabase.functions.invoke('apply-routing-rules', {
        body: {
          organization_id: activeOrgId,
          dry_run: dryRun,
        },
      });

      if (error) {
        throw new Error(`Failed to apply routing rules: ${error.message}`);
      }

      return data as BulkApplyResult;
    },
    onSuccess: (data) => {
      if (!data.dry_run) {
        // Invalidate workspace entries and recordings after actual apply
        queryClient.invalidateQueries({ queryKey: queryKeys.workspaceEntries.all });
        queryClient.invalidateQueries({ queryKey: queryKeys.calls.all });
        toast.success(`Moved ${data.moved} recording${data.moved !== 1 ? 's' : ''} to matching workspaces`);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message ?? 'Failed to apply routing rules');
    },
  });
}

/**
 * Upserts the default routing destination for the active organization.
 */
export function useUpsertRoutingDefault() {
  const queryClient = useQueryClient();
  const activeOrgId = useOrgContextStore((s) => s.activeOrgId);
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: {
      target_workspace_id: string;
      target_folder_id: string | null;
    }) => {
      if (!activeOrgId) throw new Error('No active organization');
      if (!user) throw new Error('Must be authenticated to set a default destination');

      const { data, error } = await supabase
        .from('import_routing_defaults')
        .upsert(
          {
            organization_id: activeOrgId,
            updated_by: user.id,
            updated_at: new Date().toISOString(),
            ...input,
          },
          { onConflict: 'organization_id' }
        )
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to save default destination: ${error.message}`);
      }

      return data as RoutingDefault;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.routingRules.defaults(activeOrgId ?? undefined),
      });
      toast.success('Default destination updated');
    },
    onError: (error: Error) => {
      toast.error(error.message ?? 'Failed to save default destination');
    },
  });
}
