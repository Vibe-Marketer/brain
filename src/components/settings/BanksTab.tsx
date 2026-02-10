/**
 * BanksTab Component
 *
  * Settings tab for managing workspaces and hubs.
 * - Shows all banks user is a member of
 * - Displays vaults within each bank
 * - Allows vault creation and management for bank admins/owners
 *
 * @pattern settings-banks-tab
 * @see .planning/phases/09-bank-vault-architecture/09-CONTEXT.md
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  RiBuilding4Line,
  RiUserLine,
  RiArrowRightLine,
  RiDeleteBinLine,
  RiInformationLine,
} from '@remixicon/react'
import { useBankContext } from '@/hooks/useBankContext'
import { VaultManagement } from './VaultManagement'
import { DeleteBankDialog } from '@/components/dialogs/DeleteBankDialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export function BanksTab() {
  const navigate = useNavigate()
  const { banks, activeBank, isLoading, bankRole } = useBankContext()
  const [deletingBank, setDeletingBank] = useState<typeof banks[0] | null>(null)

  if (isLoading) {
    return <div className="animate-pulse h-64 bg-muted rounded-lg" />
  }

  // Determine if the current user can manage each bank
  const canManageBank = (role: string | null) => {
    return role === 'bank_owner' || role === 'bank_admin'
  }

  // Default to first bank if no activeBank
  const defaultBankId = activeBank?.id || banks[0]?.id

  return (
    <div className="space-y-6">
       <div>
        <h2 className="text-2xl font-bold">Workspaces & Hubs</h2>
        <p className="text-muted-foreground">
          Manage your workspaces and collaboration spaces
        </p>
      </div>

      {/* Migration banner - vault management has moved */}
      <div className="flex items-start gap-3 p-4 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
        <RiInformationLine className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
            Hub management has moved to the Hubs page
          </p>
          <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
            Create, manage, and invite members to hubs from the dedicated Hubs page.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/vaults')}
          className="flex-shrink-0 gap-1.5"
          aria-label="Go to Hubs"
        >
          Go to Hubs
          <RiArrowRightLine className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Bank list as tabs */}
      {banks.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            No workspaces found. This shouldn't happen - please contact support.
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue={defaultBankId} className="space-y-4">
          <TabsList className="gap-1 md:gap-1">
            {banks.map((bank) => (
              <TabsTrigger
                key={bank.id}
                value={bank.id}
                className="gap-2 normal-case font-medium !px-3.5 !py-2 !pb-2 rounded-full data-[state=active]:after:hidden data-[state=active]:bg-card data-[state=active]:shadow-sm"
              >
                {bank.type === 'personal' ? (
                  <RiUserLine className="h-4 w-4" />
                ) : (
                  <RiBuilding4Line className="h-4 w-4" />
                )}
                {bank.name}
              </TabsTrigger>
            ))}
          </TabsList>

          {banks.map((bank) => (
            <TabsContent key={bank.id} value={bank.id} className="space-y-6">
              {/* Bank details card */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{bank.name}</CardTitle>
                      <CardDescription>
                        {bank.type === 'personal'
                          ? 'Your personal workspace for private recordings'
                          : 'Business workspace for team collaboration'}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="capitalize">
                        {bank.type}
                      </Badge>
                      <Badge variant="secondary" className="capitalize">
                        {bank.membership.role.replace('bank_', '')}
                      </Badge>
                      {bank.type === 'business' && bank.membership.role === 'bank_owner' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Delete workspace"
                          onClick={() => setDeletingBank(bank)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <RiDeleteBinLine className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                {bank.type === 'business' && (
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Cross-Workspace Default:</span>
                        <span className="ml-2 capitalize">
                          {bank.cross_bank_default.replace('_', ' ')}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Created:</span>
                        <span className="ml-2">
                          {new Date(bank.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>

              {/* Vault management */}
              <VaultManagement
                bankId={bank.id}
                canManage={canManageBank(bank.membership.role)}
              />
            </TabsContent>
          ))}
        </Tabs>
      )}
      {/* Delete Bank Dialog */}
      <DeleteBankDialog
        open={!!deletingBank}
        onOpenChange={(open) => !open && setDeletingBank(null)}
        bank={deletingBank}
      />
    </div>
  )
}

export default BanksTab
