/**
 * VaultManagement Component
 *
 * Vault management UI for the Banks settings tab.
 * - Lists vaults in a bank
 * - Create vault dialog
 * - Default folders created for team vaults (Hall of Fame, Manager Reviews)
 *
 * @pattern settings-vault-management
 * @see .planning/phases/09-bank-vault-architecture/09-CONTEXT.md
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  RiAddLine,
  RiTeamLine,
  RiSettings3Line,
  RiArrowRightSLine,
  RiArrowRightLine,
  RiInformationLine,
} from '@remixicon/react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import type { VaultType } from '@/types/bank'

interface VaultManagementProps {
  bankId: string
  canManage: boolean
}

// Interface for vault data returned from query
// Note: TypeScript types not yet regenerated for new tables (vaults, vault_memberships)
// Using explicit interface until `supabase gen types` is run
interface VaultQueryResult {
  id: string
  bank_id: string
  name: string
  vault_type: string
  default_sharelink_ttl_days: number
  created_at: string
  updated_at: string
  vault_memberships: Array<{
    id: string
    user_id: string
    role: string
  }>
}

// Type-safe supabase client wrapper for tables not yet in generated types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

export function VaultManagement({ bankId, canManage }: VaultManagementProps) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [newVaultName, setNewVaultName] = useState('')
  const [newVaultType, setNewVaultType] = useState<VaultType>('team')

  // Fetch vaults for this bank
  // Note: TypeScript types not yet regenerated for new tables (vaults, vault_memberships)
  const { data: vaults, isLoading } = useQuery({
    queryKey: ['vaults', bankId],
    queryFn: async (): Promise<VaultQueryResult[]> => {
      const { data, error } = await db
        .from('vaults')
        .select(`
          id,
          bank_id,
          name,
          vault_type,
          default_sharelink_ttl_days,
          created_at,
          updated_at,
          vault_memberships (
            id,
            user_id,
            role
          )
        `)
        .eq('bank_id', bankId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as VaultQueryResult[]
    },
    enabled: !!bankId,
  })

  // Create vault mutation
  const createVault = useMutation({
    mutationFn: async ({ name, type }: { name: string; type: VaultType }) => {
      // Create vault
      const { data: vault, error: vaultError } = await db
        .from('vaults')
        .insert({
          bank_id: bankId,
          name,
          vault_type: type,
        })
        .select()
        .single()

      if (vaultError) throw vaultError

      // Create vault membership for creator as owner
      const { error: membershipError } = await db
        .from('vault_memberships')
        .insert({
          vault_id: vault.id,
          user_id: user!.id,
          role: 'vault_owner',
        })

      if (membershipError) throw membershipError

      // Create default folders for team vaults (per CONTEXT.md)
      // TEAM-07: Hierarchical sharing is implemented via folder visibility:
      // - 'all_members': Everyone in vault sees content
      // - 'managers_only': Only managers and above see content
      // - 'owner_only': Only folder creator sees content
      // This is the design decision per CONTEXT.md: "default folder visibility: all_members, sensitive stuff is explicit"
      if (type === 'team') {
        const defaultFolders = [
          { name: 'Hall of Fame', visibility: 'all_members' },
          { name: 'Manager Reviews', visibility: 'managers_only' },
        ]

        for (const folder of defaultFolders) {
          await supabase.from('folders').insert({
            vault_id: vault.id,
            user_id: user!.id,
            name: folder.name,
            visibility: folder.visibility,
          })
        }
      }

      return vault
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vaults', bankId] })
      queryClient.invalidateQueries({ queryKey: ['bankContext'] })
      setCreateDialogOpen(false)
      setNewVaultName('')
      toast.success('Vault created successfully')
    },
    onError: (error) => {
      toast.error(`Failed to create vault: ${error.message}`)
    },
  })

  const handleCreateVault = () => {
    if (!newVaultName.trim()) {
      toast.error('Vault name is required')
      return
    }
    createVault.mutate({ name: newVaultName.trim(), type: newVaultType })
  }

  if (isLoading) {
    return <div className="animate-pulse h-32 bg-muted rounded-lg" />
  }

  return (
    <div className="space-y-4">
      {/* Deprecation notice */}
      <div className="flex items-start gap-3 p-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20">
        <RiInformationLine className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-xs text-amber-800 dark:text-amber-200">
            Vault management is now available on the{' '}
            <button
              type="button"
              onClick={() => navigate('/vaults')}
              className="font-medium underline hover:no-underline"
            >
              Vaults page
            </button>
            . This settings view will be removed in a future update.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Vaults</h3>
          <p className="text-sm text-muted-foreground">
            Manage collaboration spaces within this bank
          </p>
        </div>
        {canManage && (
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <RiAddLine className="h-4 w-4 mr-2" />
                Create Vault
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Vault</DialogTitle>
                <DialogDescription>
                  Create a collaboration space for your team
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Vault Name</label>
                  <Input
                    value={newVaultName}
                    onChange={(e) => setNewVaultName(e.target.value)}
                    placeholder="e.g., Sales Team, Marketing"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Vault Type</label>
                  <Select
                    value={newVaultType}
                    onValueChange={(v) => setNewVaultType(v as VaultType)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="team">Team</SelectItem>
                      <SelectItem value="coach" disabled>
                        Coach (Coming Soon)
                      </SelectItem>
                      <SelectItem value="client" disabled>
                        Client (Coming Soon)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setCreateDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateVault}
                  disabled={createVault.isPending}
                >
                  {createVault.isPending ? 'Creating...' : 'Create Vault'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Vault list */}
      <div className="space-y-3">
        {vaults?.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              No vaults yet. Create one to get started.
            </CardContent>
          </Card>
        ) : (
          vaults?.map((vault) => (
            <VaultCard
              key={vault.id}
              vault={vault}
              canManage={canManage}
            />
          ))
        )}
      </div>
    </div>
  )
}

interface VaultCardProps {
  vault: VaultQueryResult
  canManage: boolean
}

function VaultCard({ vault, canManage }: VaultCardProps) {
  const memberCount = vault.vault_memberships?.length || 0

  return (
    <Card>
      <CardHeader className="py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <RiTeamLine className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle className="text-base">{vault.name}</CardTitle>
              <CardDescription className="text-xs">
                {memberCount} member{memberCount !== 1 ? 's' : ''} &middot; {vault.vault_type}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="capitalize">
              {vault.vault_type}
            </Badge>
            {canManage && (
              <Button variant="ghost" size="icon">
                <RiSettings3Line className="h-4 w-4" />
              </Button>
            )}
            <RiArrowRightSLine className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </CardHeader>
    </Card>
  )
}

export default VaultManagement
