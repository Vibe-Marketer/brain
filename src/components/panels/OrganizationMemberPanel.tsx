import { useState, useCallback, useMemo, useEffect } from 'react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  RiCloseLine,
  RiBuildingLine,
  RiUserAddLine,
  RiUserLine,
  RiTeamLine,
  RiMoreLine,
  RiShieldUserLine,
  RiLogoutCircleLine,
  RiDeleteBinLine,
  RiMailLine,
} from '@remixicon/react'
import { usePanelStore } from '@/stores/panelStore'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { OrganizationInviteDialog } from '@/components/dialogs/OrganizationInviteDialog'

/** Role badge styling */
const ROLE_BADGE_STYLES: Record<string, { bg: string; text: string }> = {
  organization_owner: { bg: 'bg-vibe-orange/15', text: 'text-vibe-orange' },
  organization_admin: { bg: 'bg-info-bg', text: 'text-info-text' },
  member: { bg: 'bg-neutral-bg', text: 'text-neutral-text' },
}

export interface OrganizationMember {
  id: string
  user_id: string
  email: string
  display_name: string
  role: string
  created_at: string
}

export function OrganizationMemberPanel({ organizationId, organizationName }: { organizationId: string, organizationName: string }) {
  const { closePanel } = usePanelStore()
  const { user } = useAuth()
  const [members, setMembers] = useState<OrganizationMember[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)

  const fetchMembers = useCallback(async () => {
    setIsLoading(true)
    try {
      // Fetch memberships joined with profiles
      const { data, error } = await supabase
        .from('organization_memberships')
        .select(`
          id,
          user_id,
          role,
          created_at,
          profiles:user_profiles!user_id (
            email,
            display_name
          )
        `)
        .eq('organization_id', organizationId)

      if (error) throw error

      const formattedMembers = (data || []).map((m: any) => ({
        id: m.id,
        user_id: m.user_id,
        role: m.role,
        created_at: m.created_at,
        email: m.profiles?.email || '',
        display_name: m.profiles?.display_name || ''
      }))

      setMembers(formattedMembers)
    } catch (error: any) {
      toast.error('Failed to load members')
    } finally {
      setIsLoading(false)
    }
  }, [organizationId])

  useEffect(() => {
    fetchMembers()
  }, [fetchMembers])

  const filteredMembers = useMemo(() => {
    return members.filter(m => 
      m.display_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.email?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [members, searchTerm])

  const currentUserMembership = members.find(m => m.user_id === user?.id)
  const currentUserRole = currentUserMembership?.role
  const canManage = currentUserRole === 'organization_owner' || currentUserRole === 'organization_admin'

  const handleRemoveMember = async (member: OrganizationMember) => {
    if (member.role === 'organization_owner') {
      toast.error('Cannot remove organization owner')
      return
    }
    if (!confirm(`Remove ${member.display_name || member.email} from organization?`)) return

    try {
      const { error } = await supabase
        .from('organization_memberships')
        .delete()
        .eq('id', member.id)
      
      if (error) throw error
      toast.success('Member removed')
      fetchMembers()
    } catch (error: any) {
      toast.error('Failed to remove member')
    }
  }

  const handleChangeRole = async (member: OrganizationMember, newRole: string) => {
    if (member.role === 'organization_owner') return

    try {
      const { error } = await supabase
        .from('organization_memberships')
        .update({ role: newRole })
        .eq('id', member.id)
      
      if (error) throw error
      toast.success('Role updated')
      fetchMembers()
    } catch (error: any) {
      toast.error('Failed to update role')
    }
  }

  return (
    <div className="h-full flex flex-col bg-card/30 backdrop-blur-xl">
      {/* Premium Header */}
      <header className="flex items-center justify-between px-4 py-4 border-b border-border/40 bg-card/50 backdrop-blur-md sticky top-0 z-10 flex-shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-vibe-orange/10 flex items-center justify-center border border-vibe-orange/20">
            <RiBuildingLine className="h-4.5 w-4.5 text-vibe-orange" aria-hidden="true" />
          </div>
          <div className="flex flex-col min-w-0">
            <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] leading-none mb-1">
              Organization
            </h3>
            <p className="text-sm font-bold text-foreground truncate max-w-[180px]">
              {organizationName || 'Members'}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full hover:bg-muted/80 transition-colors"
          onClick={() => closePanel()}
          aria-label="Close members panel"
        >
          <RiCloseLine className="h-4 w-4" aria-hidden="true" />
        </Button>
      </header>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          <div className="flex items-center gap-2">
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search members"
              className="h-8 text-xs"
            />
            {canManage && (
              <Button size="sm" className="h-8 px-2" onClick={() => setInviteDialogOpen(true)}>
                <RiUserAddLine className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-2 w-32" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-1">
              {filteredMembers.map(member => (
                <div key={member.id} className="group flex items-center gap-3 p-2 rounded-md hover:bg-accent/50 transition-colors">
                  <div className="h-8 w-8 rounded-full bg-vibe-orange/10 flex items-center justify-center border border-vibe-orange/20">
                    <RiUserLine className="h-4 w-4 text-vibe-orange" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium truncate">{member.display_name || 'No Name'}</span>
                      {member.user_id === user?.id && (
                        <Badge variant="secondary" className="text-[10px] px-1 h-3.5 bg-vibe-orange/10 text-vibe-orange border-none">You</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground truncate">{member.email}</span>
                      <span className="text-[10px] text-muted-foreground/60">•</span>
                      <span className={cn("text-[10px] font-medium uppercase tracking-wider", ROLE_BADGE_STYLES[member.role]?.text)}>
                        {member.role.replace('organization_', '')}
                      </span>
                    </div>
                  </div>
                  
                  {canManage && member.user_id !== user?.id && member.role !== 'organization_owner' && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                          <RiMoreLine className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleChangeRole(member, 'organization_admin')}>
                          Make Admin
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleChangeRole(member, 'member')}>
                          Make Member
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleRemoveMember(member)}>
                          <RiDeleteBinLine className="h-3.5 w-3.5 mr-2" />
                          Remove
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      <OrganizationInviteDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
        organizationId={organizationId}
        organizationName={organizationName}
      />
    </div>
  )
}
