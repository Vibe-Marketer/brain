/**
 * CoachJoin
 *
 * Page for accepting coach invitations via token link
 * Features:
 * - Token-based access via /coach/join/:token route
 * - Validates invite token and shows inviter info
 * - Accept button to join as a coachee
 * - Error handling for invalid/expired/already-used tokens
 * - Redirect to login if not authenticated
 */

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  RiUserHeartLine,
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
  coach_user_id: string;
  inviter_email: string | null;
  invited_by: 'coach' | 'coachee';
  expires_at: string | null;
}

export default function CoachJoin() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [inviteData, setInviteData] = useState<InviteData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAccepting, setIsAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch invite data when component mounts
  useEffect(() => {
    const fetchInviteData = async () => {
      if (!token) {
        setError('No invite token provided');
        setIsLoading(false);
        return;
      }

      try {
        // Find the pending relationship by token
        const { data: relationship, error: relationshipError } = await supabase
          .from('coach_relationships')
          .select('id, coach_user_id, coachee_user_id, invited_by, invite_expires_at, status')
          .eq('invite_token', token)
          .single();

        if (relationshipError || !relationship) {
          setError('This invite link is invalid or has already been used');
          setIsLoading(false);
          return;
        }

        // Check if already accepted
        if (relationship.status !== 'pending') {
          setError('This invitation has already been accepted');
          setIsLoading(false);
          return;
        }

        // Check if expired
        if (relationship.invite_expires_at && new Date(relationship.invite_expires_at) < new Date()) {
          setError('This invitation has expired');
          setIsLoading(false);
          return;
        }

        // Get inviter email based on who sent the invite
        let inviterEmail: string | null = null;
        const inviterId = relationship.invited_by === 'coach'
          ? relationship.coach_user_id
          : relationship.coachee_user_id;

        if (inviterId) {
          const { data: email } = await supabase.rpc('get_user_email', {
            user_id: inviterId
          });
          inviterEmail = email || null;
        }

        setInviteData({
          id: relationship.id,
          coach_user_id: relationship.coach_user_id,
          inviter_email: inviterEmail,
          invited_by: relationship.invited_by as 'coach' | 'coachee',
          expires_at: relationship.invite_expires_at,
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
      sessionStorage.setItem('pendingCoachInviteToken', token || '');
      navigate('/login');
    }
  }, [token, user, authLoading, navigate]);

  // Handle accepting the invite
  const handleAcceptInvite = async () => {
    if (!inviteData || !user) return;

    setIsAccepting(true);
    try {
      // Check if user already has a relationship with this coach
      const { data: existingRelationship } = await supabase
        .from('coach_relationships')
        .select('id')
        .eq('coach_user_id', inviteData.coach_user_id)
        .eq('coachee_user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      if (existingRelationship) {
        setError("You're already connected with this coach");
        setIsAccepting(false);
        return;
      }

      // Build update data based on who invited
      const updateData: Record<string, unknown> = {
        status: 'active',
        accepted_at: new Date().toISOString(),
        invite_token: null,
        invite_expires_at: null,
      };

      // If coach invited, the accepting user becomes the coachee
      // If coachee invited, the accepting user becomes the coach
      if (inviteData.invited_by === 'coach') {
        updateData.coachee_user_id = user.id;
      } else {
        updateData.coach_user_id = user.id;
      }

      // Accept the invite by updating the relationship
      const { error: updateError } = await supabase
        .from('coach_relationships')
        .update(updateData)
        .eq('id', inviteData.id);

      if (updateError) {
        throw updateError;
      }

      const roleDescription = inviteData.invited_by === 'coach'
        ? 'You are now connected with your coach!'
        : 'You are now connected with your coachee!';
      toast.success(roleDescription);
      navigate('/coaches');
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
            <Button onClick={() => navigate('/coaches')} className="w-full">
              <RiUserHeartLine className="w-4 h-4 mr-2" />
              Go to Coaches
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

  // Determine role-specific content
  const isBecomingCoachee = inviteData?.invited_by === 'coach';
  const roleTitle = isBecomingCoachee ? 'Coaching Invitation' : 'Coachee Invitation';
  const roleDescription = isBecomingCoachee
    ? 'wants to be your coach'
    : 'wants you to be their coach';

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
          <CardTitle className="text-2xl">{roleTitle}</CardTitle>
          <CardDescription className="text-base mt-2">
            {inviteData?.inviter_email ? (
              <>
                <span className="font-medium text-foreground">{inviteData.inviter_email}</span>
                {' '}{roleDescription}
              </>
            ) : (
              isBecomingCoachee
                ? "You've been invited to join as a coachee"
                : "You've been invited to be a coach"
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* What you'll get */}
          <div className="bg-muted/50 rounded-lg p-4">
            <h3 className="font-medium text-sm text-foreground mb-3">
              {isBecomingCoachee ? 'As a coachee, you can:' : 'As a coach, you can:'}
            </h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {isBecomingCoachee ? (
                <>
                  <li className="flex items-start gap-2">
                    <RiCheckLine className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>Share your call recordings with your coach</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <RiCheckLine className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>Receive feedback and coaching notes on your calls</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <RiCheckLine className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>Control which calls and folders are visible to your coach</span>
                  </li>
                </>
              ) : (
                <>
                  <li className="flex items-start gap-2">
                    <RiCheckLine className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>View calls shared by your coachee</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <RiCheckLine className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>Add private coaching notes to their calls</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <RiCheckLine className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>Help your coachee improve their performance</span>
                  </li>
                </>
              )}
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
                  Accepting...
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
