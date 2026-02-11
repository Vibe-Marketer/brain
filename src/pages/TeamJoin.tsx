/**
 * TeamJoin
 *
 * Page for accepting team invitations via token link
 * Features:
 * - Token-based access via /team/join/:token route
 * - Validates invite token and shows inviter info
 * - Accept button to join the team
 * - Error handling for invalid/expired/already-used tokens
 * - Redirect to login if not authenticated
 */

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  RiTeamLine,
  RiErrorWarningLine,
  RiCheckLine,
  RiTimeLine,
  RiArrowLeftLine,
  RiUserAddLine,
} from '@remixicon/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getErrorToastMessage } from '@/lib/user-friendly-errors';

interface InviteData {
  id: string;
  team_id: string;
  inviter_email: string | null;
  team_name: string | null;
  expires_at: string | null;
}

export default function TeamJoin() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [inviteData, setInviteData] = useState<InviteData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAccepting, setIsAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch invite data when component mounts
  // Now looks up team by invite_token on teams table (shareable links)
  useEffect(() => {
    const fetchInviteData = async () => {
      if (!token) {
        setError('No invite token provided');
        setIsLoading(false);
        return;
      }

      try {
        // Find the team by invite token (stored on teams table for shareable links)
        const { data: team, error: teamError } = await supabase
          .from('teams')
          .select('id, name, owner_user_id, invite_token, invite_expires_at')
          .eq('invite_token', token)
          .single();

        if (teamError || !team) {
          setError('This invite link is invalid or has already been used');
          setIsLoading(false);
          return;
        }

        // Check if expired
        if (team.invite_expires_at && new Date(team.invite_expires_at) < new Date()) {
          setError('This invitation has expired');
          setIsLoading(false);
          return;
        }

        // Check if user is already a member of this team
        if (user) {
          const { data: existingMembership } = await supabase
            .from('team_memberships')
            .select('id')
            .eq('team_id', team.id)
            .eq('user_id', user.id)
            .neq('status', 'removed')
            .maybeSingle();

          if (existingMembership) {
            setError("You're already a member of this hub");
            setIsLoading(false);
            return;
          }
        }

        // Get owner display name as inviter
        let inviterEmail: string | null = null;
        if (team.owner_user_id) {
          // Use user_settings table to get display name
          const { data: settings } = await supabase
            .from('user_settings')
            .select('display_name')
            .eq('user_id', team.owner_user_id)
            .maybeSingle();
          inviterEmail = settings?.display_name || 'A hub admin';
        }

        setInviteData({
          id: team.id, // Using team ID since we no longer have a membership ID
          team_id: team.id,
          inviter_email: inviterEmail,
          team_name: team.name || null,
          expires_at: team.invite_expires_at,
        });
        setIsLoading(false);
      } catch (err) {
        setError('Failed to load invitation details');
        setIsLoading(false);
      }
    };

    if (!authLoading && user) {
      fetchInviteData();
    } else if (!authLoading && !user) {
      // Store the current URL to redirect back after login
      sessionStorage.setItem('pendingTeamInviteToken', token || '');
      navigate('/login');
    }
  }, [token, user, authLoading, navigate]);

  // Handle accepting the invite
  // Creates a new membership for the joining user
  const handleAcceptInvite = async () => {
    if (!inviteData || !user) return;

    setIsAccepting(true);
    try {
      // Check if user is already a member of this team
      const { data: existingMembership } = await supabase
        .from('team_memberships')
        .select('id')
        .eq('team_id', inviteData.team_id)
        .eq('user_id', user.id)
        .neq('status', 'removed')
        .maybeSingle();

      if (existingMembership) {
        setError("You're already a member of this hub");
        setIsAccepting(false);
        return;
      }

      // Create a new membership for the joining user
      const { error: insertError } = await supabase
        .from('team_memberships')
        .insert({
          team_id: inviteData.team_id,
          user_id: user.id,
          role: 'member',
          status: 'active',
          joined_at: new Date().toISOString(),
        });

      if (insertError) {
        throw insertError;
      }

      const teamName = inviteData.team_name || 'the hub';
      toast.success(`You've joined ${teamName}!`);
      navigate('/vaults');
    } catch (err) {
      toast.error(getErrorToastMessage(err));
      setIsAccepting(false);
    }
  };

  // Loading state
  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading invitation...</p>
        </div>
      </div>
    );
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
            <Button onClick={() => navigate('/vaults')} className="w-full">
              <RiTeamLine className="w-4 h-4 mr-2" />
              Go to Hubs
            </Button>
            <Button variant="hollow" onClick={() => navigate('/')} className="w-full">
              <RiArrowLeftLine className="w-4 h-4 mr-2" />
              Go Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
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
          <CardTitle className="text-2xl">Hub Invitation</CardTitle>
          <CardDescription className="text-base mt-2">
            {inviteData?.inviter_email ? (
              <>
                <span className="font-medium text-foreground">{inviteData.inviter_email}</span>
                {' '}has invited you to join
              </>
            ) : (
              "You've been invited to join"
            )}
            {inviteData?.team_name && (
              <>
                {' '}<span className="font-medium text-foreground">{inviteData.team_name}</span>
              </>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* What you'll get */}
          <div className="bg-muted/50 rounded-lg p-4">
            <h3 className="font-medium text-sm text-foreground mb-3">As a hub member, you'll be able to:</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <RiCheckLine className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <span>Collaborate in your hub on call recordings</span>
              </li>
              <li className="flex items-start gap-2">
                <RiCheckLine className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <span>Share calls and folders with teammates</span>
              </li>
              <li className="flex items-start gap-2">
                <RiCheckLine className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <span>View calls shared by your manager</span>
              </li>
            </ul>
          </div>

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
              onClick={handleAcceptInvite}
              disabled={isAccepting}
              className="w-full"
            >
              {isAccepting ? (
                <>
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                  Joining...
                </>
              ) : (
                <>
                  <RiCheckLine className="w-4 h-4 mr-2" />
                  Accept Invitation
                </>
              )}
            </Button>
            <Button
              variant="hollow"
              onClick={() => navigate('/')}
              disabled={isAccepting}
              className="w-full"
            >
              Decline
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
