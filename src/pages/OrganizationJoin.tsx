import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  RiBuildingLine,
  RiErrorWarningLine,
  RiCheckLine,
  RiTimeLine,
  RiArrowLeftLine,
  RiUserAddLine,
} from '@remixicon/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'
import { getOrganizationInviteDetails, acceptOrganizationInvite, type OrganizationInviteDetails } from '@/services/organization-invitations.service'
import { useOrganizationContext } from '@/hooks/useOrganizationContext'

export default function OrganizationJoin() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const { switchOrganization, organizations } = useOrganizationContext()

  const [inviteData, setInviteData] = useState<OrganizationInviteDetails | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAccepting, setIsAccepting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchInviteData = async () => {
      if (!token) {
        setError('No invite token provided')
        setIsLoading(false)
        return
      }

      try {
        const details = await getOrganizationInviteDetails(token)
        setInviteData(details)

        // Check if user is already a member
        if (user) {
          // This check is a bit redundant if accept_organization_invite handles it, 
          // but good for UX.
          // Note: organizations in context might not be up to date if they just joined 
          // and refreshed, but usually they are.
        }
      } catch (err: any) {
        setError(err.message || 'Invitation not found or has expired')
      } finally {
        setIsLoading(false)
      }
    }

    if (!authLoading) {
      if (!user) {
        // Redirect to login but save the current URL for redirect back
        navigate(`/login?redirect=/join/org/${token}`)
      } else {
        fetchInviteData()
      }
    }
  }, [token, user, authLoading, navigate])

  const handleAccept = async () => {
    if (!token || !user) return

    setIsAccepting(true)
    try {
      await acceptOrganizationInvite(token)
      toast.success(`Welcome to ${inviteData?.organization_name}!`)
      
      // We don't have the ID here yet in the details usually, 
      // but let's assume we can navigate to home and the context will fix it.
      navigate('/')
    } catch (err: any) {
      toast.error(err.message || 'Failed to accept invitation')
    } finally {
      setIsAccepting(false)
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
        <Card className="w-full max-w-md border-destructive/20 shadow-xl shadow-destructive/5">
          <CardHeader className="text-center">
            <div className="mx-auto h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <RiErrorWarningLine className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle className="text-xl">Invite Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center flex-col gap-3">
            <Button variant="outline" onClick={() => navigate('/')}>
              <RiArrowLeftLine className="h-4 w-4 mr-2" />
              Go to Dashboard
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
            <RiBuildingLine className="h-8 w-8 text-vibe-orange" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">Organization Invite</CardTitle>
          <CardDescription>
            You've been invited to join an organization on CallVault
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="rounded-xl border border-border bg-muted/30 p-5 space-y-4">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-full bg-background border border-border flex items-center justify-center flex-shrink-0">
                <RiUserAddLine className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {inviteData?.inviter_name}
                </p>
                <p className="text-xs text-muted-foreground">invited you to join</p>
              </div>
            </div>

            <div className="pt-2 border-t border-border/50">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">Organization</span>
                <Badge variant="outline" className="text-xs font-semibold px-2 py-0 h-5">
                  {inviteData?.role.replace('bank_', '').replace('organization_', '')}
                </Badge>
              </div>
              <p className="text-lg font-bold text-foreground">
                {inviteData?.organization_name}
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
              <RiTimeLine className="h-3.5 w-3.5" />
              <span>Expires {format(new Date(inviteData?.expires_at || ''), 'MMM d, yyyy')}</span>
            </div>
          </div>

          <div className="space-y-3">
            <Button 
              className="w-full h-12 text-base font-semibold" 
              onClick={handleAccept}
              disabled={isAccepting}
            >
              {isAccepting ? 'Joining...' : 'Accept Invite & Join'}
            </Button>
            <Button 
              variant="ghost" 
              className="w-full text-muted-foreground"
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
