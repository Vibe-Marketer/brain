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
  const { workspaces = [], isLoading: workspacesLoading } = useWorkspaces(orgId);
  const { data: folders = [], isLoading: foldersLoading } = useFolders(value?.workspaceId ?? null);

  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(value?.workspaceId ?? null);

  useEffect(() => {
    setSelectedWorkspaceId(value?.workspaceId ?? null);
  }, [value?.workspaceId]);

  function handleWorkspaceChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const workspaceId = e.target.value || null;
    setSelectedWorkspaceId(workspaceId);
    if (workspaceId) {
      onChange({ workspaceId, folderId: null });
    }
  }

  function handleFolderChange(e: React.ChangeEvent<HTMLSelectElement>) {
    if (!selectedWorkspaceId) return;
    const rawValue = e.target.value;
    const folderId = rawValue === '' ? null : rawValue;
    onChange({ workspaceId: selectedWorkspaceId, folderId });
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-2 w-full sm:w-auto', className)}>
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
