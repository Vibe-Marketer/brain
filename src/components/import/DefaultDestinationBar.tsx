/**
 * DefaultDestinationBar — Org-level default routing destination setting.
 */

import { useRoutingDefault, useUpsertRoutingDefault } from '@/hooks/useRoutingRules';
import { useOrgContextStore } from '@/stores/orgContextStore';
import { DestinationPicker } from './DestinationPicker';
import type { RoutingDestination } from '@/types/routing';

export function DefaultDestinationBar() {
  const activeOrgId = useOrgContextStore((s) => s.activeOrgId);
  const { data: routingDefault, isLoading } = useRoutingDefault();
  const { mutate: upsertDefault, isPending } = useUpsertRoutingDefault();

  if (!activeOrgId) return null;

  const currentDestination: RoutingDestination | null = routingDefault
    ? {
        vaultId: routingDefault.target_vault_id,
        folderId: routingDefault.target_folder_id,
      }
    : null;

  function handleDestinationChange(dest: RoutingDestination) {
    upsertDefault({
      target_vault_id: dest.vaultId,
      target_folder_id: dest.folderId,
    });
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3.5">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">
            Unmatched calls go to
          </p>
          {!routingDefault && !isLoading && (
            <p className="text-xs text-amber-500 mt-0.5">
              Set a default destination for calls that don't match any rule
            </p>
          )}
        </div>

        <DestinationPicker
          value={currentDestination}
          onChange={handleDestinationChange}
          orgId={activeOrgId}
          disabled={isLoading || isPending}
        />
      </div>

      <p className="text-xs text-muted-foreground px-0.5">
        All imported calls that don't match a routing rule will be sent here.
      </p>
    </div>
  );
}
