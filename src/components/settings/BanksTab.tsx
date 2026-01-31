/**
 * BanksTab Component
 *
 * Settings tab for managing banks and vaults.
 * - Shows all banks user is a member of
 * - Displays vaults within each bank
 * - Allows vault creation and management for bank admins/owners
 *
 * @pattern settings-banks-tab
 * @see .planning/phases/09-bank-vault-architecture/09-CONTEXT.md
 */

import {
  RiBuilding4Line,
  RiUserLine,
} from '@remixicon/react'
import { useBankContext } from '@/hooks/useBankContext'
import { VaultManagement } from './VaultManagement'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export function BanksTab() {
  const { banks, activeBank, isLoading, bankRole } = useBankContext()

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
        <h2 className="text-2xl font-bold">Banks & Vaults</h2>
        <p className="text-muted-foreground">
          Manage your banks and collaboration spaces
        </p>
      </div>

      {/* Bank list as tabs */}
      {banks.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            No banks found. This shouldn't happen - please contact support.
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue={defaultBankId} className="space-y-4">
          <TabsList>
            {banks.map((bank) => (
              <TabsTrigger key={bank.id} value={bank.id} className="gap-2">
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
                    </div>
                  </div>
                </CardHeader>
                {bank.type === 'business' && (
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Cross-Bank Default:</span>
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
    </div>
  )
}

export default BanksTab
