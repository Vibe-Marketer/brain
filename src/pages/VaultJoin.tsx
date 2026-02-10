/**
 * VaultJoin
 *
 * Page for accepting vault invitations via token link.
 * Follows the exact same pattern as TeamJoin.tsx.
 *
 * Features:
 * - Token-based access via /join/vault/:token route
 * - Validates invite token and checks expiration
 * - Shows vault info + join button
 * - Error handling for invalid/expired/already-member states
 * - Redirect to login if not authenticated
 */

import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  RiSafeLine,
  RiErrorWarningLine,
  RiCheckLine,
  RiTimeLine,
  RiArrowLeftLine,
  RiUserAddLine,
  RiGroupLine,
} from '@remixicon/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { getErrorToastMessage } from '@/lib/user-friendly-errors'

interface VaultInviteData {
  vault_id: string
  vault_name: string
  member_count: number
  expires_at: string | null
}

export default function VaultJoin() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()

  const [inviteData, setInviteData] = useState<VaultInviteData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isJoining, setIsJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [alreadyMemberVaultId, setAlreadyMemberVaultId] = useState<string | null>(null)

  // Fetch invite data when component mounts
  useEffect(() => {
    const fetchInviteData = async () => {
      if (!token) {
        setError('No invite token provided')
        setIsLoading(false)
        return
      }

      try {
        // Find the vault by invite token
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: vault, error: vaultError } = await (supabase as any)
          .from('vaults')
          .select('id, name, invite_token, invite_expires_at')
          .eq('invite_token', token)
          .single()

        if (vaultError || !vault) {
          setError('This invite link is invalid or has already been used')
          setIsLoading(false)
          return
        }

        // Check if expired
        if (vault.invite_expires_at && new Date(vault.invite_expires_at) < new Date()) {
          setError('This invite link has expired')
          setIsLoading(false)
          return
        }

        // Check if user is already a member
        if (user) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: existingMembership } = await (supabase as any)
            .from('vault_memberships')
            .select('id')
            .eq('vault_id', vault.id)
            .eq('user_id', user.id)
            .maybeSingle()

          if (existingMembership) {
            setAlreadyMemberVaultId(vault.id)
            setError("You're already a member of this vault")
            setIsLoading(false)
            return
          }
        }

        // Get member count for display
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: memberData } = await (supabase as any)
          .from('vault_memberships')
          .select('id')
          .eq('vault_id', vault.id)

        setInviteData({
          vault_id: vault.id,
          vault_name: vault.name,
          member_count: memberData?.length || 0,
          expires_at: vault.invite_expires_at,
        })
        setIsLoading(false)
      } catch {
        setError('Failed to load invitation details')
        setIsLoading(false)
      }
    }

    if (!authLoading && user) {
      fetchInviteData()
    } else if (!authLoading && !user) {
      // Store the current URL to redirect back after login
      sessionStorage.setItem('pendingVaultInviteToken', token || '')
      navigate('/login')
    }
  }, [token, user, authLoading, navigate])

  // Handle joining the vault
  const handleJoinVault = async () => {
    if (!inviteData || !user) return

    setIsJoining(true)
    try {
      // Double-check membership
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existingMembership } = await (supabase as any)
        .from('vault_memberships')
        .select('id')
        .eq('vault_id', inviteData.vault_id)
        .eq('user_id', user.id)
        .maybeSingle()

      if (existingMembership) {
        setAlreadyMemberVaultId(inviteData.vault_id)
        setError("You're already a member of this vault")
        setIsJoining(false)
        return
      }

      // Create vault_membership with role='member' (LOCKED: default join role is always member)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: insertError } = await (supabase as any)
        .from('vault_memberships')
        .insert({
          vault_id: inviteData.vault_id,
          user_id: user.id,
          role: 'member',
        })

      if (insertError) {
        throw insertError
      }

      toast.success(`Joined vault '${inviteData.vault_name}'`)
      navigate(`/vaults/${inviteData.vault_id}`)
    } catch (err) {
      toast.error(getErrorToastMessage(err))
      setIsJoining(false)
    }
  }

  // Loading state
  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading invitation...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <RiErrorWarningLine className="w-16 h-16 text-destructive" />
            </div>
            <CardTitle className="text-2xl">Invitation Problem</CardTitle>
            <CardDescription className="text-base mt-2">
              {error}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {alreadyMemberVaultId ? (
              <Button onClick={() => navigate(`/vaults/${alreadyMemberVaultId}`)} className="w-full">
                <RiSafeLine className="w-4 h-4 mr-2" />
                Go to Vault
              </Button>
            ) : (
              <Button onClick={() => navigate('/vaults')} className="w-full">
                <RiSafeLine className="w-4 h-4 mr-2" />
                Go to Vaults
              </Button>
            )}
            <Button variant="hollow" onClick={() => navigate('/')} className="w-full">
              <RiArrowLeftLine className="w-4 h-4 mr-2" />
              Go Home
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Success state - show invitation details
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <RiUserAddLine className="w-8 h-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">Vault Invitation</CardTitle>
          <CardDescription className="text-base mt-2">
            You've been invited to join{' '}
            <span className="font-medium text-foreground">{inviteData?.vault_name}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* What you'll get */}
          <div className="bg-muted/50 rounded-lg p-4">
            <h3 className="font-medium text-sm text-foreground mb-3">As a vault member, you'll be able to:</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <RiCheckLine className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <span>Access shared call recordings in this vault</span>
              </li>
              <li className="flex items-start gap-2">
                <RiCheckLine className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <span>Collaborate with other vault members</span>
              </li>
              <li className="flex items-start gap-2">
                <RiCheckLine className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <span>Use AI chat scoped to vault recordings</span>
              </li>
            </ul>
          </div>

          {/* Member count */}
          {inviteData && inviteData.member_count > 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <RiGroupLine className="w-4 h-4" />
              <span>
                {inviteData.member_count} {inviteData.member_count === 1 ? 'member' : 'members'} already in this vault
              </span>
            </div>
          )}

          {/* Expiration notice */}
          {inviteData?.expires_at && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <RiTimeLine className="w-4 h-4" />
              <span>
                Expires {new Date(inviteData.expires_at).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-col gap-3">
            <Button
              onClick={handleJoinVault}
              disabled={isJoining}
              className="w-full"
            >
              {isJoining ? (
                <>
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                  Joining...
                </>
              ) : (
                <>
                  <RiCheckLine className="w-4 h-4 mr-2" />
                  Join Vault
                </>
              )}
            </Button>
            <Button
              variant="hollow"
              onClick={() => navigate('/')}
              disabled={isJoining}
              className="w-full"
            >
              Decline
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
