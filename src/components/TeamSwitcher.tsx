import * as React from 'react';
import { RiTeamLine, RiUserLine, RiCheckLine, RiArrowDownSLine, RiAddLine, RiSettingsLine } from '@remixicon/react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveTeam } from '@/hooks/useActiveTeam';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface Team {
  id: string;
  name: string;
}

interface TeamMembership {
  id: string;
  team_id: string;
  teams: Team;
}

/**
 * TeamSwitcher - Dropdown for switching between teams and personal workspace
 * 
 * CONTEXT.md decisions:
 * - "Teams appear in top-right dropdown (team switcher near user avatar)"
 * - "Personal workspace exists alongside team workspaces"
 * - "Clear team badge in header shows current team context"
 */
export function TeamSwitcher() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { activeTeamId, isLoading: contextLoading, switchTeam, switchToPersonal } = useActiveTeam();

  // Fetch user's teams via their memberships
  const { data: memberships, isLoading: teamsLoading } = useQuery({
    queryKey: ['team-memberships', 'user', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('team_memberships')
        .select(`
          id,
          team_id,
          teams:teams(id, name)
        `)
        .eq('user_id', user.id)
        .eq('status', 'active');
      
      if (error) {
        console.error('Error fetching team memberships:', error);
        return [];
      }
      
      return (data ?? []) as TeamMembership[];
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const isLoading = contextLoading || teamsLoading;
  const teams = memberships?.map(m => m.teams).filter(Boolean) ?? [];
  const hasTeams = teams.length > 0;
  
  // Find active team name
  const activeTeam = teams.find(t => t.id === activeTeamId);
  const isPersonal = !activeTeamId;

  // Always show the TeamSwitcher - even without teams, show "Personal" workspace
  // This allows admins to access team features and test team functionality

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <Skeleton className="h-6 w-20" />
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm"
          className="flex items-center gap-1.5 px-2 h-8 text-sm font-medium"
        >
          {isPersonal ? (
            <>
              <RiUserLine className="h-4 w-4 text-muted-foreground" />
              <span className="hidden sm:inline">Personal</span>
            </>
          ) : (
            <>
              <RiTeamLine className="h-4 w-4 text-vibe-orange" />
              <span className="hidden sm:inline max-w-[100px] truncate">{activeTeam?.name}</span>
            </>
          )}
          <RiArrowDownSLine className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-56 bg-background border-border z-50">
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
          Switch workspace
        </DropdownMenuLabel>
        
        {/* Personal workspace option */}
        <DropdownMenuItem 
          onClick={() => switchToPersonal()}
          className="cursor-pointer flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <RiUserLine className="h-4 w-4" />
            <span>Personal</span>
          </div>
          {isPersonal && <RiCheckLine className="h-4 w-4 text-vibe-orange" />}
        </DropdownMenuItem>
        
        {hasTeams && <DropdownMenuSeparator />}
        
        {/* Team options */}
        {teams.map((team) => (
          <DropdownMenuItem
            key={team.id}
            onClick={() => switchTeam(team.id)}
            className="cursor-pointer flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <RiTeamLine className="h-4 w-4" />
              <span className="truncate max-w-[150px]">{team.name}</span>
            </div>
            {activeTeamId === team.id && <RiCheckLine className="h-4 w-4 text-vibe-orange" />}
          </DropdownMenuItem>
        ))}
        
        <DropdownMenuSeparator />
        
        {/* Manage Teams link */}
        <DropdownMenuItem 
          onClick={() => navigate('/settings/team')}
          className="cursor-pointer flex items-center gap-2 text-muted-foreground"
        >
          <RiSettingsLine className="h-4 w-4" />
          <span>Manage Hubs</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
