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
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'

interface WorkspaceInviteData {
  workspace_id: string
  workspace_name: string
  organization_name: string
  inviter_name: string | null
  member_count: number
  expires_at: string | null
  role: string
  is_email_invite: boolean
}

export default function WorkspaceJoin() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()

  const [inviteData, setInviteData] = useState<WorkspaceInviteData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isJoining, setIsJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchInviteData = async () => {
      if (!token) {
        setError('No invite token provided')
        setIsLoading(false)
        return
      }

      try {
        // 1. Try email-based invitation first (via RPC)
        const { data: inviteDetails, error: rpcError } = await supabase.rpc('get_workspace_invite_details', {
          p_token: token,
        })

        if (!rpcError && inviteDetails && (Array.isArray(inviteDetails) ? inviteDetails.length > 0 : true)) {
          const det = Array.isArray(inviteDetails) ? inviteDetails[0] : inviteDetails
          
          setInviteData({
            workspace_id: det.workspace_id || det.id, // Depending on RPC return
            workspace_name: det.workspace_name,
            organization_name: det.organization_name,
            inviter_name: det.inviter_display_name,
            member_count: 0, // Not provided by RPC
            expires_at: det.expires_at,
            role: det.role,
            is_email_invite: true
          })
          setIsLoading(false)
          return
        }

        // 2. Fallback to shareable link (stored on workspaces table)
        const { data: workspace, error: workspaceError } = await supabase
          .from('workspaces')
          .select(`
            id, 
            name, 
            invite_token, 
            invite_expires_at,
            organization:organizations ( name )
          `)
          .eq('invite_token', token)
          .single()

        if (workspaceError || !workspace) {
          setError('This invite link is invalid or has already been used')
          setIsLoading(false)
          return
        }

        // Check if expired
        if (workspace.invite_expires_at && new Date(workspace.invite_expires_at) < new Date()) {
          setError('This invite link has expired')
          setIsLoading(false)
          return
        }

        setInviteData({
          workspace_id: workspace.id,
          workspace_name: workspace.name,
          organization_name: workspace.organization.name,
          inviter_name: null,
          member_count: 0,
          expires_at: workspace.invite_expires_at,
          role: 'member',
          is_email_invite: false
        })
      } catch (err: any) {
        setError(err.message || 'Invitation not found')
      } finally {
        setIsLoading(false)
      }
    }

    if (!authLoading) {
      if (!user) {
        navigate(`/login?redirect=/join/workspace/${token}`)
      } else {
        fetchInviteData()
      }
    }
  }, [token, user, authLoading, navigate])

  const handleJoin = async () => {
    if (!token || !user || !inviteData) return

    setIsJoining(true)
    try {
      if (inviteData.is_email_invite) {
        // Use RPC to accept email-based invite
        const { data, error } = await supabase.rpc('accept_workspace_invite', {
          p_token: token,
          p_user_id: user.id
        })
        
        if (error || (data && data.error)) throw new Error(error?.message || data?.error)
      } else {
        // Directly insert for shareable links
        const { error: joinError } = await supabase
          .from('workspace_memberships')
          .insert({
            workspace_id: inviteData.workspace_id,
            user_id: user.id,
            role: 'member',
          })

        if (joinError) {
          if (joinError.message.includes('unique constraint')) {
            toast.success("You're already a member!")
            navigate('/')
            return
          }
          throw joinError
        }
      }

      toast.success(`Joined ${inviteData.workspace_name}!`)
      navigate('/')
    } catch (err: any) {
      toast.error(err.message || 'Failed to join workspace')
    } finally {
      setIsJoining(false)
    }
  }

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-vibe-orange/20" />
          <div className="h-4 w-48 bg-muted rounded" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md border-destructive/20">
          <CardHeader className="text-center">
            <RiErrorWarningLine className="mx-auto h-12 w-12 text-destructive mb-4" />
            <CardTitle>Invite Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button variant="outline" onClick={() => navigate('/')}>
              Return home
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-2xl border-vibe-orange/10">
        <CardHeader className="text-center">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-vibe-orange/10 flex items-center justify-center mb-6 border border-vibe-orange/20">
            <RiGroupLine className="h-8 w-8 text-vibe-orange" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">Workspace Invite</CardTitle>
          <CardDescription>
            You've been invited to join a workspace on CallVault
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="rounded-xl border border-border bg-muted/30 p-5 space-y-4">
            {inviteData?.inviter_name && (
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-full bg-background border border-border flex items-center justify-center flex-shrink-0">
                  <RiUserAddLine className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {inviteData.inviter_name}
                  </p>
                  <p className="text-xs text-muted-foreground">invited you to join</p>
                </div>
              </div>
            )}

            <div className="pt-2 border-t border-border/50">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">{inviteData?.organization_name}</span>
                <Badge variant="outline" className="text-xs font-semibold px-2 py-0 h-5">
                  {inviteData?.role.replace('vault_', '').replace('workspace_', '')}
                </Badge>
              </div>
              <p className="text-lg font-bold text-foreground">
                {inviteData?.workspace_name}
              </p>
            </div>

            {inviteData?.expires_at && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                <RiTimeLine className="h-3.5 w-3.5" />
                <span>Expires {format(new Date(inviteData.expires_at), 'MMM d, yyyy')}</span>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <Button 
              className="w-full h-12 text-base font-semibold" 
              onClick={handleJoin}
              disabled={isJoining}
            >
              {isJoining ? 'Joining...' : 'Accept Invite & Join'}
            </Button>
            <Button
              variant="hollow"
              className="w-full"
              onClick={() => navigate('/')}
            >
              Decline
            </Button>
          </div>
        </CardContent>

        <div className="px-6 py-4 bg-muted/20 border-t border-border/40 text-center">
          <p className="text-xs text-muted-foreground">
            Logged in as <span className="font-medium text-foreground">{user?.email}</span>
          </p>
        </div>
      </Card>
    </div>
  )
}
