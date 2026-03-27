/**
 * DestinationPicker — Cascading org > workspace > folder select for routing destinations.
 *
 * When the user has multiple org memberships, an org selector appears first.
 * Selecting a different org shows a workspace picker for that org (cross-org routing).
 * Selecting the current org shows the existing workspace + folder picker.
 */

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useWorkspaces } from '@/hooks/useWorkspaces';
import { useFolders } from '@/hooks/useFolders';
import { useOrganizations } from '@/hooks/useOrganizations';
import type { RoutingDestination } from '@/types/routing';

interface DestinationPickerProps {
  value: RoutingDestination | null;
  onChange: (dest: RoutingDestination) => void;
  /** The organization that owns the routing rule (current active org). */
  orgId: string;
  disabled?: boolean;
  className?: string;
}

const selectClass = cn(
  'h-9 rounded-md border border-border bg-background pl-3 pr-8 py-1',
  'text-sm text-foreground overflow-hidden text-ellipsis whitespace-nowrap',
  'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0',
  'disabled:opacity-50 disabled:cursor-not-allowed',
  'cursor-pointer w-full sm:w-auto min-w-[120px] max-w-full sm:max-w-[200px]'
);

export function DestinationPicker({
  value,
  onChange,
  orgId,
  disabled = false,
  className,
}: DestinationPickerProps) {
  // Determine the effective target org (null = same as current org)
  const targetOrgId = value?.targetOrganizationId ?? null;
  const effectiveOrgId = targetOrgId ?? orgId;

  const { data: allOrgs = [], isLoading: orgsLoading } = useOrganizations();
  const { workspaces = [], isLoading: workspacesLoading } = useWorkspaces(effectiveOrgId);
  const { data: folders = [], isLoading: foldersLoading } = useFolders(
    // Only load folders for same-org selection (cross-org rules land in HOME workspace)
    targetOrgId ? null : (value?.workspaceId ?? null)
  );

  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(
    value?.workspaceId ?? null
  );

  useEffect(() => {
    setSelectedWorkspaceId(value?.workspaceId ?? null);
  }, [value?.workspaceId]);

  // Show org selector only when user belongs to more than one org
  const showOrgSelector = allOrgs.length > 1;

  function handleOrgChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const selectedOrgId = e.target.value || orgId;
    const isCrossOrg = selectedOrgId !== orgId;

    // Reset workspace/folder selection when org changes
    setSelectedWorkspaceId(null);
    onChange({
      workspaceId: '',
      folderId: null,
      targetOrganizationId: isCrossOrg ? selectedOrgId : null,
    });
  }

  function handleWorkspaceChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const workspaceId = e.target.value || null;
    setSelectedWorkspaceId(workspaceId);
    if (workspaceId) {
      onChange({
        workspaceId,
        folderId: null,
        targetOrganizationId: targetOrgId,
      });
    }
  }

  function handleFolderChange(e: React.ChangeEvent<HTMLSelectElement>) {
    if (!selectedWorkspaceId) return;
    const rawValue = e.target.value;
    const folderId = rawValue === '' ? null : rawValue;
    onChange({
      workspaceId: selectedWorkspaceId,
      folderId,
      targetOrganizationId: targetOrgId,
    });
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-2 w-full sm:w-auto', className)}>
      {showOrgSelector && (
        <>
          <select
            value={effectiveOrgId}
            onChange={handleOrgChange}
            disabled={disabled || orgsLoading}
            aria-label="Select organization"
            className={selectClass}
          >
            {orgsLoading ? (
              <option value="">Loading…</option>
            ) : (
              allOrgs.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))
            )}
          </select>
          <span className="text-muted-foreground text-sm">/</span>
        </>
      )}

      <select
        value={selectedWorkspaceId ?? ''}
        onChange={handleWorkspaceChange}
        disabled={disabled || workspacesLoading}
        aria-label="Select workspace"
        className={selectClass}
      >
        <option value="">
          {workspacesLoading ? 'Loading…' : 'Select workspace'}
        </option>
        {workspaces.map((ws) => (
          <option key={ws.id} value={ws.id}>
            {ws.name}
          </option>
        ))}
      </select>

      {/* Folder picker — only for same-org rules; cross-org lands in HOME workspace */}
      {selectedWorkspaceId && !targetOrgId && (
        <>
          <span className="text-muted-foreground text-sm">/</span>
          <select
            value={value?.folderId ?? ''}
            onChange={handleFolderChange}
            disabled={disabled || foldersLoading}
            aria-label="Select folder (optional)"
            className={selectClass}
          >
            <option value="">
              {foldersLoading ? 'Loading…' : 'No folder (root)'}
            </option>
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.name}
              </option>
            ))}
          </select>
        </>
      )}
    </div>
  );
}
