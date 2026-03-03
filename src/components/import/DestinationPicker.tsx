/**
 * DestinationPicker — Cascading workspace > folder select for routing destinations.
 */

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useWorkspaces } from '@/hooks/useWorkspaces';
import { useFolders } from '@/hooks/useFolders';
import type { RoutingDestination } from '@/types/routing';

interface DestinationPickerProps {
  value: RoutingDestination | null;
  onChange: (dest: RoutingDestination) => void;
  orgId: string;
  disabled?: boolean;
  className?: string;
}

const selectClass = cn(
  'h-8 rounded-md border border-border bg-background px-2.5 py-1',
  'text-sm text-foreground',
  'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0',
  'disabled:opacity-50 disabled:cursor-not-allowed',
  'cursor-pointer'
);

export function DestinationPicker({
  value,
  onChange,
  orgId,
  disabled = false,
  className,
}: DestinationPickerProps) {
  const { data: workspaces = [], isLoading: workspacesLoading } = useWorkspaces(orgId);
  const { data: folders = [], isLoading: foldersLoading } = useFolders(value?.vaultId ?? null);

  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(value?.vaultId ?? null);

  useEffect(() => {
    setSelectedWorkspaceId(value?.vaultId ?? null);
  }, [value?.vaultId]);

  function handleWorkspaceChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const vaultId = e.target.value || null;
    setSelectedWorkspaceId(vaultId);
    if (vaultId) {
      onChange({ vaultId, folderId: null });
    }
  }

  function handleFolderChange(e: React.ChangeEvent<HTMLSelectElement>) {
    if (!selectedWorkspaceId) return;
    const rawValue = e.target.value;
    const folderId = rawValue === '' ? null : rawValue;
    onChange({ vaultId: selectedWorkspaceId, folderId });
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
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

      {selectedWorkspaceId && (
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
