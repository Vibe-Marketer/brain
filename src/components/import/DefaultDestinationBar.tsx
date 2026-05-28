/**
 * DefaultDestinationBar — default routing destination setting.
 */

import { useEffect, useState } from 'react';
import { RiAddLine, RiCheckLine } from '@remixicon/react';
import { Button } from '@/components/ui/button';
import { CreateWorkspaceDialog } from '@/components/dialogs/CreateWorkspaceDialog';
import { useRoutingDefault, useUpsertRoutingDefault } from '@/hooks/useRoutingRules';
import { useCreateWorkspace } from '@/hooks/useWorkspaceMutations';
import { useOrganizationWorkspaces } from '@/hooks/useWorkspaces';
import { useOrgContextStore } from '@/stores/orgContextStore';
import { DestinationPicker } from './DestinationPicker';
import type { RoutingDestination } from '@/types/routing';

interface DefaultDestinationBarProps {
  sourceApp?: string;
  providerName?: string;
  title?: string;
  emptyStateText?: string;
  description?: string;
  value?: RoutingDestination | null;
  onChange?: (dest: RoutingDestination) => void;
  persistDefault?: boolean;
  allowApplyModeChoice?: boolean;
}

export function DefaultDestinationBar({
  sourceApp = 'all',
  providerName,
  title,
  emptyStateText,
  description,
  value,
  onChange,
  persistDefault = true,
  allowApplyModeChoice = false,
}: DefaultDestinationBarProps) {
  const [applyAsDefault, setApplyAsDefault] = useState(persistDefault);
  const [createWorkspaceOpen, setCreateWorkspaceOpen] = useState(false);
  const activeOrgId = useOrgContextStore((s) => s.activeOrgId);
  const isConnectorDefault = sourceApp !== 'all';
  const displayName = providerName ?? sourceApp;
  const { workspaces } = useOrganizationWorkspaces(activeOrgId);
  const { data: routingDefault, isLoading } = useRoutingDefault(sourceApp);
  const { mutate: upsertDefault, mutateAsync: upsertDefaultAsync, isPending } =
    useUpsertRoutingDefault(sourceApp);
  const createWorkspace = useCreateWorkspace();

  const matchingWorkspace = isConnectorDefault
    ? workspaces.find(
        (workspace) =>
          workspace.name.trim().toLowerCase() === displayName.trim().toLowerCase(),
      )
    : null;
  const defaultDestination: RoutingDestination | null = routingDefault
    ? {
        workspaceId: routingDefault.target_workspace_id,
        folderId: routingDefault.target_folder_id,
      }
    : null;
  const currentDestination = value !== undefined ? value : defaultDestination;
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

  useEffect(() => {
    setApplyAsDefault(persistDefault);
  }, [persistDefault]);

  if (!activeOrgId) return null;

  function saveDestinationAsDefault(dest: RoutingDestination) {
    upsertDefault({
      target_workspace_id: dest.workspaceId,
      target_folder_id: dest.folderId,
    });
  }

  function handleDestinationChange(dest: RoutingDestination) {
    onChange?.(dest);
    if (applyAsDefault) {
      saveDestinationAsDefault(dest);
    }
  }

  function handleApplyModeChange(nextApplyAsDefault: boolean) {
    setApplyAsDefault(nextApplyAsDefault);
    if (nextApplyAsDefault && currentDestination?.workspaceId) {
      saveDestinationAsDefault(currentDestination);
    }
  }

  async function handleUseConnectorWorkspace() {
    if (!activeOrgId || connectorActionDisabled) return;

    const workspace =
      matchingWorkspace ??
      (await createWorkspace.mutateAsync({
        orgId: activeOrgId,
        name: displayName,
      }));

    const destination = {
      workspaceId: workspace.id,
      folderId: null,
    };
    onChange?.(destination);
    if (applyAsDefault) {
      await upsertDefaultAsync({
        target_workspace_id: destination.workspaceId,
        target_folder_id: destination.folderId,
      });
    }
  }

  function handleCreatedWorkspace(workspaceId: string) {
    handleDestinationChange({
      workspaceId,
      folderId: null,
      targetOrganizationId: null,
    });
  }

  const showConnectorWorkspaceShortcut =
    isConnectorDefault && persistDefault && !allowApplyModeChoice;
  const showGenericCreateWorkspace = allowApplyModeChoice;

  return (
    <div className="space-y-1.5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-border/60 bg-card p-3.5">
        <div className="flex flex-1 min-w-0 shrink-0 flex-col gap-2">
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
          {allowApplyModeChoice && (
            <div className="inline-flex w-fit rounded-lg border border-border/60 bg-muted/30 p-0.5">
              <button
                type="button"
                onClick={() => handleApplyModeChange(false)}
                className={`h-7 rounded-md px-2.5 text-xs font-medium transition-colors ${
                  !applyAsDefault
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                This import
              </button>
              <button
                type="button"
                onClick={() => handleApplyModeChange(true)}
                className={`h-7 rounded-md px-2.5 text-xs font-medium transition-colors ${
                  applyAsDefault
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Save default
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:justify-end min-w-0 w-full sm:w-auto">
          {showConnectorWorkspaceShortcut && (
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
          {showGenericCreateWorkspace && (
            <Button
              type="button"
              variant="hollow"
              size="sm"
              onClick={() => setCreateWorkspaceOpen(true)}
              disabled={createWorkspace.isPending}
              className="shrink-0"
            >
              <RiAddLine className="mr-1.5 h-3.5 w-3.5" />
              New workspace
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
          (applyAsDefault
            ? isConnectorDefault
              ? `New ${displayName} imports use this destination unless an import or routing rule chooses another workspace.`
              : "All imported calls that don't match a routing rule will be sent here."
            : "This destination applies only to the current import.")}
      </p>

      {activeOrgId && (
        <CreateWorkspaceDialog
          open={createWorkspaceOpen}
          onOpenChange={setCreateWorkspaceOpen}
          orgId={activeOrgId}
          onWorkspaceCreated={handleCreatedWorkspace}
        />
      )}
    </div>
  );
}
