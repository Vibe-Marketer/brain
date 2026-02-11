/**
 * VaultListPane - Secondary pane showing vault list for active bank
 *
 * Displays vaults filtered by the active bank from useBankContext.
 * Shows bank name prominently, vault cards with type badges and member counts.
 *
 * @pattern vault-list-pane
 * @brand-version v4.2
 */

import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  RiSafeLine,
  RiAddLine,
  RiGroupLine,
  RiUserLine,
  RiTeamLine,
  RiCommunityLine,
  RiBriefcaseLine,
  RiBuildingLine,
  RiYoutubeLine,
  RiErrorWarningLine,
} from '@remixicon/react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { CreateVaultDialog } from '@/components/dialogs/CreateVaultDialog';
import { CreateBusinessBankDialog } from '@/components/dialogs/CreateBusinessBankDialog';
import { BankSwitcher } from '@/components/header/BankSwitcher';
import { useBankContext } from '@/hooks/useBankContext';
import { useVaults } from '@/hooks/useVaults';
import { queryKeys } from '@/lib/query-config';
import type { VaultType } from '@/types/bank';
import type { VaultWithMeta } from '@/hooks/useVaults';

export interface VaultListPaneProps {
  /** Currently selected vault ID */
  selectedVaultId: string | null;
  /** Callback when a vault is selected */
  onVaultSelect: (vaultId: string) => void;
  /** Additional CSS classes */
  className?: string;
}

/** Type badge config for each vault type */
const VAULT_TYPE_CONFIG: Record<VaultType, {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  className: string;
}> = {
  personal: {
    label: 'Personal',
    icon: RiUserLine,
    className: 'bg-info-bg text-info-text',
  },
  team: {
    label: 'Team',
    icon: RiTeamLine,
    className: 'bg-success-bg text-success-text',
  },
  coach: {
    label: 'Coach',
    icon: RiBriefcaseLine,
    className: 'bg-warning-bg text-warning-text',
  },
  community: {
    label: 'Community',
    icon: RiCommunityLine,
    className: 'bg-warning-bg text-warning-text',
  },
  client: {
    label: 'Client',
    icon: RiBriefcaseLine,
    className: 'bg-info-bg text-info-text',
  },
  youtube: {
    label: 'YouTube',
    icon: RiYoutubeLine,
    className: 'bg-red-500/10 text-red-600',
  },
};

/** Loading skeleton for vault list */
function VaultListSkeleton() {
  return (
    <div className="space-y-2 px-2 py-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="p-3 rounded-lg">
          <div className="flex items-center gap-3">
            <Skeleton className="w-8 h-8 rounded-md flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-2.5 w-1/2" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Empty state when no vaults exist */
function VaultListEmpty({
  onCreateClick,
  canCreate,
}: {
  onCreateClick?: () => void;
  canCreate: boolean;
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-center">
      <RiSafeLine className="h-16 w-16 text-muted-foreground/50 mb-4" aria-hidden="true" />
      <p className="text-sm font-display font-extrabold uppercase tracking-wide text-foreground mb-1">
        No hubs yet
      </p>
      <p className="text-xs text-muted-foreground mb-4">
        Create your first hub to start collaborating
      </p>
      <Button
        variant="default"
        size="sm"
        onClick={canCreate ? onCreateClick : undefined}
        className="gap-1.5"
        disabled={!canCreate}
        aria-label="Create hub"
      >
        <RiAddLine className="h-4 w-4" aria-hidden="true" />
        Create Hub
      </Button>
    </div>
  );
}

function VaultListError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-center">
      <RiErrorWarningLine className="h-12 w-12 text-destructive/60 mb-3" aria-hidden="true" />
      <p className="text-sm font-semibold text-foreground mb-1">Unable to load vaults</p>
      <p className="text-xs text-muted-foreground mb-4">
        Please check your connection and try again.
      </p>
      <Button variant="outline" size="sm" onClick={onRetry} aria-label="Retry loading hubs">
        Try Again
      </Button>
    </div>
  );
}

export function VaultListPane({
  selectedVaultId,
  onVaultSelect,
  className,
}: VaultListPaneProps) {
  const queryClient = useQueryClient();
  const { activeBankId, activeBank, bankRole, banks } = useBankContext();
  const { vaults, isLoading, error } = useVaults(activeBankId);
  const canCreateVault = bankRole === 'bank_owner' || bankRole === 'bank_admin';
  const businessBanks = banks.filter((bank) => bank.type === 'business');
  const hasBusinessBanks = businessBanks.length > 0;

  // Track mount state for enter animations
  const [isMounted, setIsMounted] = React.useState(false);
  React.useEffect(() => {
    const timer = setTimeout(() => setIsMounted(true), 10);
    return () => clearTimeout(timer);
  }, []);

  // Refs for vault buttons for keyboard navigation
  const buttonRefs = React.useRef<Map<string, HTMLButtonElement>>(new Map());

  // Focus a vault by index (wraps around)
  const focusVaultByIndex = React.useCallback(
    (index: number) => {
      if (vaults.length === 0) return;
      const wrappedIndex = ((index % vaults.length) + vaults.length) % vaults.length;
      const vaultId = vaults[wrappedIndex].id;
      const button = buttonRefs.current.get(vaultId);
      button?.focus();
    },
    [vaults]
  );

  // Keyboard navigation handler
  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent, vaultId: string) => {
      const currentIndex = vaults.findIndex((v) => v.id === vaultId);

      switch (event.key) {
        case 'Enter':
        case ' ':
          event.preventDefault();
          onVaultSelect(vaultId);
          break;
        case 'ArrowDown':
          event.preventDefault();
          focusVaultByIndex(currentIndex + 1);
          break;
        case 'ArrowUp':
          event.preventDefault();
          focusVaultByIndex(currentIndex - 1);
          break;
        case 'Home':
          event.preventDefault();
          focusVaultByIndex(0);
          break;
        case 'End':
          event.preventDefault();
          focusVaultByIndex(vaults.length - 1);
          break;
      }
    },
    [vaults, onVaultSelect, focusVaultByIndex]
  );

  // Create Vault dialog state
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  // Create Business Bank dialog state
  const [createBankDialogOpen, setCreateBankDialogOpen] = React.useState(false);

  const handleCreateVault = React.useCallback(() => {
    if (!canCreateVault) return;
    setCreateDialogOpen(true);
  }, [canCreateVault]);

  const handleVaultCreated = React.useCallback(
    (vaultId: string) => {
      onVaultSelect(vaultId);
    },
    [onVaultSelect]
  );

  return (
    <div
      className={cn(
        'h-full flex flex-col',
        // Pane enter animation
        'transition-all duration-500 ease-in-out',
        isMounted ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2',
        className
      )}
      role="navigation"
      aria-label="Hub list"
    >
      {/* Header */}
      <header className="flex-shrink-0 border-b border-border bg-card/50">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0" id="hub-list-title">
              <div className="w-8 h-8 rounded-lg bg-vibe-orange/10 flex items-center justify-center flex-shrink-0" aria-hidden="true">
                <RiSafeLine className="h-4 w-4 text-vibe-orange" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-ink uppercase tracking-wide">HUBS</h2>
                <p className="text-xs text-ink-muted">Select a workspace hub</p>
              </div>
            </div>
            {canCreateVault && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCreateVault}
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                title="Create Hub"
                aria-label="Create hub"
              >
                <RiAddLine className="h-4 w-4" />
              </Button>
            )}
          </div>

          <div className="mt-3 space-y-2">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                {activeBank?.type === 'personal' ? 'Personal Workspace' : 'Business Workspace'}
              </p>
              <p className="text-sm font-display font-extrabold uppercase tracking-wide text-foreground truncate">
                {activeBank?.name || 'Loading...'}
              </p>
            </div>
            <div className="max-w-full">
              <BankSwitcher />
            </div>
          </div>
        </div>
      </header>

      {/* Vault List */}
      {isLoading ? (
        <VaultListSkeleton />
      ) : error ? (
        <VaultListError
          onRetry={() => queryClient.invalidateQueries({ queryKey: queryKeys.vaults.list() })}
        />
      ) : vaults.length === 0 ? (
        <VaultListEmpty
          onCreateClick={handleCreateVault}
          canCreate={canCreateVault}
        />
      ) : (
        <div
          className="flex-1 overflow-y-auto py-2 px-2"
          role="list"
          aria-labelledby="hub-list-title"
        >
          {vaults.map((vault: VaultWithMeta) => {
            const isActive = selectedVaultId === vault.id;
            const typeConfig = VAULT_TYPE_CONFIG[vault.vault_type] || VAULT_TYPE_CONFIG.personal;
            const TypeIcon = typeConfig.icon;
            const VaultIcon = RiSafeLine;

            return (
              <div
                key={vault.id}
                role="listitem"
                className="relative mb-1"
              >
                <button
                  ref={(el) => {
                    if (el) {
                      buttonRefs.current.set(vault.id, el);
                    } else {
                      buttonRefs.current.delete(vault.id);
                    }
                  }}
                  type="button"
                  onClick={() => onVaultSelect(vault.id)}
                  onKeyDown={(e) => handleKeyDown(e, vault.id)}
                  className={cn(
                    'relative w-full flex items-start gap-3 px-3 py-3 rounded-lg',
                    'text-left transition-all duration-500 ease-in-out',
                    'hover:bg-hover/70',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-vibe-orange focus-visible:ring-offset-2',
                    isActive && [
                      'bg-hover border border-border',
                      'border-l-0 pl-4',
                      "before:content-[''] before:absolute before:left-1 before:top-1/2 before:-translate-y-1/2 before:w-1 before:h-[65%] before:rounded-full before:bg-vibe-orange",
                    ]
                  )}
                  aria-current={isActive ? 'true' : undefined}
                  aria-label={`${vault.name}: ${typeConfig.label} hub, ${vault.member_count} member${vault.member_count !== 1 ? 's' : ''}`}
                >
                  {/* Vault icon */}
                  <div
                    className={cn(
                      'w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0',
                       'bg-card border border-border',
                      'transition-all duration-200 ease-in-out',
                      isActive && 'border-vibe-orange/30 bg-vibe-orange/10'
                    )}
                    aria-hidden="true"
                  >
                    <VaultIcon
                      className={cn(
                        'h-4 w-4 transition-colors duration-200 ease-in-out',
                        isActive ? 'text-vibe-orange' : 'text-muted-foreground'
                      )}
                    />
                  </div>

                  {/* Vault info */}
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'block text-sm font-medium truncate',
                          'transition-colors duration-200 ease-in-out',
                          isActive ? 'text-foreground' : 'text-foreground'
                        )}
                      >
                        {vault.name}
                      </span>
                    </div>

                    {/* Type badge + member count */}
                    <div className="flex items-center gap-2 mt-1">
                      {/* Type badge */}
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md',
                          typeConfig.className
                        )}
                      >
                        <TypeIcon className="h-3 w-3" />
                        {typeConfig.label}
                      </span>

                      {/* Member count */}
                      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                        <RiGroupLine className="h-3 w-3" />
                        <span className="tabular-nums">{vault.member_count}</span>
                      </span>
                    </div>
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Business Bank CTA */}
      <div className="flex-shrink-0 border-t border-border px-3 py-3">
        {hasBusinessBanks ? (
          <button
            type="button"
            onClick={() => setCreateBankDialogOpen(true)}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-2 rounded-lg',
              'text-sm text-muted-foreground hover:text-foreground',
              'hover:bg-hover/70',
              'transition-colors duration-200'
            )}
            aria-label="Create business workspace"
          >
            <RiBuildingLine className="h-4 w-4" />
            <span>Create Business Workspace</span>
          </button>
        ) : (
          <div className="rounded-lg border border-border bg-card/70 p-3 space-y-2">
            <p className="text-sm font-medium text-foreground">
              Create your first business workspace to collaborate with your team
            </p>
            <Button
              variant="default"
              size="sm"
              onClick={() => setCreateBankDialogOpen(true)}
              className="gap-1.5"
              aria-label="Create business workspace"
            >
              <RiBuildingLine className="h-4 w-4" />
              Create Business Workspace
            </Button>
          </div>
        )}
      </div>

      {/* Create Vault Dialog */}
      {activeBankId && canCreateVault && (
        <CreateVaultDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          bankId={activeBankId}
          onVaultCreated={handleVaultCreated}
        />
      )}

      {/* Create Business Bank Dialog */}
      <CreateBusinessBankDialog
        open={createBankDialogOpen}
        onOpenChange={setCreateBankDialogOpen}
      />
    </div>
  );
}

export default VaultListPane;
