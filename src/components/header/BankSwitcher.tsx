import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RiUserLine,
  RiBuildingLine,
  RiCheckLine,
  RiArrowDownSLine,
  RiAddLine,
  RiSettingsLine,
  RiFolderLine,
  RiTeamLine,
  RiBriefcaseLine,
} from '@remixicon/react';
import { cn } from '@/lib/utils';
import { useBankContext } from '@/hooks/useBankContext';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuGroup,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { CreateBusinessBankDialog } from '@/components/dialogs/CreateBusinessBankDialog';
import type { BankWithMembership, VaultWithMembership } from '@/types/bank';

/**
 * BankSwitcher - Dropdown for switching between banks and vaults
 *
 * Replaces TeamSwitcher with the new bank/vault architecture:
 * - Shows current bank with icon (personal vs business)
 * - Shows current vault if selected
 * - Dropdown lists all user's banks
 * - Vaults section within active bank
 * - "All Recordings" option for no vault filter
 * - "Create Business Bank" CTA for new orgs
 *
 * @pattern follows TeamSwitcher for consistency
 */
export function BankSwitcher() {
  const navigate = useNavigate();
  const {
    activeBank,
    activeVault,
    banks,
    vaults,
    isLoading,
    switchBank,
    switchVault,
    isPersonalBank,
  } = useBankContext();

  // Create Business Bank dialog state
  const [createBankDialogOpen, setCreateBankDialogOpen] = React.useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-28" />
      </div>
    );
  }

  // No bank selected yet (shouldn't happen with proper initialization)
  if (!activeBank) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="flex items-center gap-1.5 px-2 h-8 text-sm font-medium"
        >
          {isPersonalBank ? (
            <>
              <RiUserLine className="h-4 w-4 text-muted-foreground" />
                <span className="hidden sm:inline">Personal Workspace</span>
            </>
          ) : (
            <>
              <RiBuildingLine className="h-4 w-4 text-muted-foreground" />
              <span className="hidden sm:inline max-w-[100px] truncate">
                {activeBank.name}
              </span>
            </>
          )}
          {activeVault && (
            <>
              <span className="text-muted-foreground">/</span>
              <span className="hidden sm:inline max-w-[80px] truncate text-muted-foreground">
                {activeVault.name}
              </span>
            </>
          )}
          <RiArrowDownSLine className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64 bg-background border-border z-50">
        {/* Personal Workspace Section */}
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
          Personal Workspace
        </DropdownMenuLabel>
        {banks.filter((b) => b.type === 'personal').map((bank) => (
          <BankMenuItem
            key={bank.id}
            bank={bank}
            isActive={bank.id === activeBank.id}
            onClick={() => switchBank(bank.id)}
          />
        ))}

        {/* Business Workspaces Section */}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
          Business Workspaces
        </DropdownMenuLabel>
        <DropdownMenuGroup>
          {banks.filter((b) => b.type === 'business').length === 0 ? (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              <div>No business workspaces</div>
              <div>Create one to collaborate</div>
            </div>
          ) : (
            banks.filter((b) => b.type === 'business').map((bank) => (
              <BankMenuItem
                key={bank.id}
                bank={bank}
                isActive={bank.id === activeBank.id}
                onClick={() => switchBank(bank.id)}
              />
            ))
          )}
        </DropdownMenuGroup>

        {/* Hubs in active workspace */}
        {vaults.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
              Hubs in {activeBank.name}
            </DropdownMenuLabel>
            <DropdownMenuGroup>
              {/* Show all recordings (no vault filter) */}
              <DropdownMenuItem
                className={cn(
                  'cursor-pointer flex items-center justify-between',
                  !activeVault && 'bg-accent'
                )}
                onClick={() => switchVault(null)}
              >
                <div className="flex items-center gap-2">
                  <RiFolderLine className="h-4 w-4" />
                  <span>All Recordings</span>
                </div>
                {!activeVault && (
                  <RiCheckLine className="h-4 w-4 text-vibe-orange" />
                )}
              </DropdownMenuItem>

              {vaults.map((vault) => (
                <VaultMenuItem
                  key={vault.id}
                  vault={vault}
                  isActive={vault.id === activeVault?.id}
                  onClick={() => switchVault(vault.id)}
                />
              ))}
            </DropdownMenuGroup>
          </>
        )}

        <DropdownMenuSeparator />

        {/* Create Business Workspace */}
        <DropdownMenuItem
          className="cursor-pointer flex items-center gap-2 text-muted-foreground"
          onClick={() => setCreateBankDialogOpen(true)}
        >
          <RiAddLine className="h-4 w-4" />
          <span>Create Business Workspace</span>
        </DropdownMenuItem>

        {/* Manage Workspaces link */}
        <DropdownMenuItem
          className="cursor-pointer flex items-center gap-2 text-muted-foreground"
          onClick={() => {
            navigate('/settings/banks');
          }}
        >
          <RiSettingsLine className="h-4 w-4" />
          <span>Manage Workspaces</span>
        </DropdownMenuItem>
      </DropdownMenuContent>

      {/* Create Business Bank Dialog */}
      <CreateBusinessBankDialog
        open={createBankDialogOpen}
        onOpenChange={setCreateBankDialogOpen}
      />
    </DropdownMenu>
  );
}

/**
 * Bank menu item with role badge
 */
function BankMenuItem({
  bank,
  isActive,
  onClick,
}: {
  bank: BankWithMembership;
  isActive: boolean;
  onClick: () => void;
}) {
  const Icon = bank.type === 'personal' ? RiUserLine : RiBuildingLine;

  // Format role for display (remove bank_ prefix)
  const roleDisplay = bank.membership.role.replace('bank_', '');

  return (
    <DropdownMenuItem
      className={cn(
        'cursor-pointer flex items-center justify-between',
        isActive && 'bg-accent'
      )}
      onClick={onClick}
    >
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4" />
        <div className="flex flex-col min-w-0">
          <span className="truncate max-w-[140px]">{bank.name}</span>
          {bank.type === 'business' && (
            <span className="text-2xs text-muted-foreground">
              {bank.member_count ?? 1} member{(bank.member_count ?? 1) !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <Badge variant="outline" className="text-xs capitalize">
          {roleDisplay}
        </Badge>
        {isActive && <RiCheckLine className="h-4 w-4 text-vibe-orange" />}
      </div>
    </DropdownMenuItem>
  );
}

/**
 * Vault menu item with type indicator
 */
function VaultMenuItem({
  vault,
  isActive,
  onClick,
}: {
  vault: VaultWithMembership;
  isActive: boolean;
  onClick: () => void;
}) {
  // Map vault types to icons
  const vaultTypeIcons = {
    personal: RiUserLine,
    team: RiTeamLine,
    coach: RiUserLine,
    community: RiTeamLine,
    client: RiBriefcaseLine,
  };
  const Icon = vaultTypeIcons[vault.vault_type] || RiFolderLine;

  return (
    <DropdownMenuItem
      className={cn(
        'cursor-pointer flex items-center justify-between pl-6',
        isActive && 'bg-accent'
      )}
      onClick={onClick}
    >
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4" />
        <span className="truncate max-w-[120px]">{vault.name}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground capitalize">
          {vault.vault_type}
        </span>
        {isActive && <RiCheckLine className="h-4 w-4 text-vibe-orange" />}
      </div>
    </DropdownMenuItem>
  );
}
