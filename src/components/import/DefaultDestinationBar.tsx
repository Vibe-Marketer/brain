/**
 * DefaultDestinationBar — default routing destination setting.
 */

import { RiAddLine, RiCheckLine } from '@remixicon/react';
import { Button } from '@/components/ui/button';
import { useRoutingDefault, useUpsertRoutingDefault } from '@/hooks/useRoutingRules';
import { useCreateWorkspace } from '@/hooks/useWorkspaceMutations';
import { useWorkspaces } from '@/hooks/useWorkspaces';
import { useOrgContextStore } from '@/stores/orgContextStore';
import { DestinationPicker } from './DestinationPicker';
import type { RoutingDestination } from '@/types/routing';

interface DefaultDestinationBarProps {
  sourceApp?: string;
  providerName?: string;
  title?: string;
  emptyStateText?: string;
  description?: string;
}

export function DefaultDestinationBar({
  sourceApp = 'all',
  providerName,
  title,
  emptyStateText,
  description,
}: DefaultDestinationBarProps) {
  const activeOrgId = useOrgContextStore((s) => s.activeOrgId);
  const isConnectorDefault = sourceApp !== 'all';
  const displayName = providerName ?? sourceApp;
  const { workspaces } = useWorkspaces(activeOrgId);
  const { data: routingDefault, isLoading } = useRoutingDefault(sourceApp);
  const { mutate: upsertDefault, mutateAsync: upsertDefaultAsync, isPending } =
    useUpsertRoutingDefault(sourceApp);
  const createWorkspace = useCreateWorkspace();

  if (!activeOrgId) return null;

  const matchingWorkspace = isConnectorDefault
    ? workspaces.find(
        (workspace) =>
          workspace.name.trim().toLowerCase() === displayName.trim().toLowerCase(),
      )
    : null;
  const currentDestination: RoutingDestination | null = routingDefault
    ? {
        workspaceId: routingDefault.target_workspace_id,
        folderId: routingDefault.target_folder_id,
      }
    : null;
  const currentWorkspaceName = workspaces.find(
    (workspace) => workspace.id === currentDestination?.workspaceId,
  )?.name;
  const isUsingNamedConnectorWorkspace =
    Boolean(matchingWorkspace?.id) &&
    matchingWorkspace?.id === currentDestination?.workspaceId;
  const connectorWorkspaceActionLabel = matchingWorkspace
    ? `Use ${displayName} workspace`
    : `Create ${displayName} workspace`;
  const connectorActionDisabled =
    isPending || createWorkspace.isPending || isUsingNamedConnectorWorkspace;

  function handleDestinationChange(dest: RoutingDestination) {
    upsertDefault({
      target_workspace_id: dest.workspaceId,
      target_folder_id: dest.folderId,
    });
  }

  async function handleUseConnectorWorkspace() {
    if (!activeOrgId || connectorActionDisabled) return;

    const workspace =
      matchingWorkspace ??
      (await createWorkspace.mutateAsync({
        orgId: activeOrgId,
        name: displayName,
      }));

    await upsertDefaultAsync({
      target_workspace_id: workspace.id,
      target_folder_id: null,
    });
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-border/60 bg-card p-3.5">
        <div className="flex-1 min-w-0 shrink-0">
          <p className="text-sm font-medium text-foreground whitespace-nowrap">
            {title ?? (isConnectorDefault
              ? `${displayName} calls go to`
              : 'Unmatched calls go to')}
          </p>
          {!routingDefault && !isLoading && (
            <p className="text-xs text-amber-500 mt-0.5">
              {emptyStateText ?? (isConnectorDefault
                ? `Set a default destination for new ${displayName} calls`
                : "Set a default destination for calls that don't match any rule")}
            </p>
          )}
          {isConnectorDefault && currentWorkspaceName && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Selected destination: {currentWorkspaceName}
            </p>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:justify-end min-w-0 w-full sm:w-auto">
          {isConnectorDefault && (
            <Button
              type="button"
              variant="hollow"
              size="sm"
              onClick={() => void handleUseConnectorWorkspace()}
              disabled={connectorActionDisabled}
              className="shrink-0"
            >
              {isUsingNamedConnectorWorkspace ? (
                <RiCheckLine className="mr-1.5 h-3.5 w-3.5" />
              ) : (
                <RiAddLine className="mr-1.5 h-3.5 w-3.5" />
              )}
              {isUsingNamedConnectorWorkspace
                ? `${displayName} workspace selected`
                : connectorWorkspaceActionLabel}
            </Button>
          )}
          <DestinationPicker
            value={currentDestination}
            onChange={handleDestinationChange}
            orgId={activeOrgId}
            disabled={isLoading || isPending}
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground px-0.5">
        {description ??
          (isConnectorDefault
            ? `New ${displayName} imports use this destination unless an import or routing rule chooses another workspace.`
            : "All imported calls that don't match a routing rule will be sent here.")}
      </p>
    </div>
  );
}
