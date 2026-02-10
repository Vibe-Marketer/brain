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
import { cn } from '@/lib/utils';
import {
  RiSafeLine,
  RiSafeFill,
  RiAddLine,
  RiGroupLine,
  RiUserLine,
  RiTeamLine,
  RiCommunityLine,
  RiBriefcaseLine,
  RiBuildingLine,
} from '@remixicon/react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { CreateVaultDialog } from '@/components/dialogs/CreateVaultDialog';
import { CreateBusinessBankDialog } from '@/components/dialogs/CreateBusinessBankDialog';
import { useBankContext } from '@/hooks/useBankContext';
import { useVaults } from '@/hooks/useVaults';
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
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  },
  team: {
    label: 'Team',
    icon: RiTeamLine,
    className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  },
  coach: {
    label: 'Coach',
    icon: RiBriefcaseLine,
    className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  },
  community: {
    label: 'Community',
    icon: RiCommunityLine,
    className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  },
  client: {
    label: 'Client',
    icon: RiBriefcaseLine,
    className: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
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
function VaultListEmpty({ onCreateClick }: { onCreateClick?: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-center">
      <div
        className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-3"
        aria-hidden="true"
      >
        <RiSafeLine className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-foreground mb-1">
        No vaults in this bank
      </p>
      <p className="text-xs text-muted-foreground mb-4">
        Create a vault to start collaborating
      </p>
      {onCreateClick && (
        <Button
          variant="default"
          size="sm"
          onClick={onCreateClick}
          className="gap-1.5"
        >
          <RiAddLine className="h-4 w-4" />
          Create Vault
        </Button>
      )}
    </div>
  );
}

export function VaultListPane({
  selectedVaultId,
  onVaultSelect,
  className,
}: VaultListPaneProps) {
  const { activeBankId, activeBank, bankRole, banks } = useBankContext();
  const { vaults, isLoading } = useVaults(activeBankId);
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
      aria-label="Vault list"
    >
      {/* Header - Bank name prominently displayed */}
      <header className="flex-shrink-0 border-b border-border bg-cb-card/50">
        {/* Bank context */}
        <div className="px-4 pt-3 pb-1">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
            {activeBank?.type === 'personal' ? 'Personal Bank' : 'Business Bank'}
          </p>
          <h2 className="text-sm font-bold text-foreground truncate">
            {activeBank?.name || 'Loading...'}
          </h2>
        </div>

        {/* Vaults title + create button */}
        <div className="flex items-center justify-between px-4 py-2">
          <h3
            className="text-xs font-bold text-muted-foreground uppercase tracking-wide font-montserrat"
            id="vault-list-title"
          >
            VAULTS
          </h3>
          {canCreateVault && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCreateVault}
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              title="Create Vault"
            >
              <RiAddLine className="h-4 w-4" />
            </Button>
          )}
        </div>
      </header>

      {/* Vault List */}
      {isLoading ? (
        <VaultListSkeleton />
      ) : vaults.length === 0 ? (
        <VaultListEmpty onCreateClick={canCreateVault ? handleCreateVault : undefined} />
      ) : (
        <div
          className="flex-1 overflow-y-auto py-2 px-2"
          role="list"
          aria-labelledby="vault-list-title"
        >
          {vaults.map((vault: VaultWithMeta) => {
            const isActive = selectedVaultId === vault.id;
            const typeConfig = VAULT_TYPE_CONFIG[vault.vault_type] || VAULT_TYPE_CONFIG.personal;
            const TypeIcon = typeConfig.icon;
            const VaultIcon = isActive ? RiSafeFill : RiSafeLine;

            return (
              <div
                key={vault.id}
                role="listitem"
                className="relative mb-1"
              >
                {/* Active indicator - left-side orange pill */}
                <div
                  className={cn(
                    'absolute left-1 top-1/2 -translate-y-1/2 w-1 h-[60%] bg-vibe-orange rounded-full',
                    'transition-all duration-200 ease-in-out',
                    isActive ? 'opacity-100 scale-y-100' : 'opacity-0 scale-y-0'
                  )}
                  aria-hidden="true"
                />
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
                    'w-full flex items-start gap-3 px-3 py-3 rounded-lg',
                    'text-left transition-all duration-500 ease-in-out',
                    'hover:bg-muted/50 dark:hover:bg-white/5',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-vibe-orange focus-visible:ring-offset-2',
                    isActive && [
                      'bg-gray-100 dark:bg-gray-800',
                      'border-l-0 pl-4', // Offset for the active indicator
                    ]
                  )}
                  aria-current={isActive ? 'true' : undefined}
                  aria-label={`${vault.name}: ${typeConfig.label} vault, ${vault.member_count} member${vault.member_count !== 1 ? 's' : ''}`}
                >
                  {/* Vault icon */}
                  <div
                    className={cn(
                      'w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0',
                      'bg-cb-card border border-border',
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
              'hover:bg-muted/50 dark:hover:bg-white/5',
              'transition-colors duration-200'
            )}
          >
            <RiBuildingLine className="h-4 w-4" />
            <span>Create Business Bank</span>
          </button>
        ) : (
          <div className="rounded-lg border border-border bg-cb-card/60 p-3 space-y-2">
            <p className="text-sm font-medium text-foreground">
              Create your first business bank to collaborate with your team
            </p>
            <Button
              variant="default"
              size="sm"
              onClick={() => setCreateBankDialogOpen(true)}
              className="gap-1.5"
            >
              <RiBuildingLine className="h-4 w-4" />
              Create Business Bank
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
