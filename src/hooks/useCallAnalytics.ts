import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { requireUser } from '@/lib/auth-utils';

interface CallAnalytics {
  totalCalls: number;
  participationRate: number;
  avgDuration: number;
  totalRecordingTime: string;
  uniqueParticipants: number;
  activeFolders: number;
  callsByFolder: Array<{ name: string; value: number }>;
  callsByTag: Array<{ name: string; value: number }>;
  callTypeDistribution: Array<{ name: string; value: number }>;
  monthlyDistribution: Array<{ name: string; value: number }>;
  durationBreakdown: Array<{ name: string; value: number }>;
  inviteesVsParticipants: Array<{ name: string; value: number }>;
}

function getDateRangeFilter(timeRange: string): Date | null {
  const now = new Date();
  switch (timeRange) {
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case '3m':
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    case '6m':
      return new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
    case '1y':
      return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    case 'all':
    default:
      return null;
  }
}

export function useCallAnalytics(timeRange: string = '30d') {
  return useQuery({
    queryKey: ['call-analytics', timeRange],
    queryFn: async (): Promise<CallAnalytics> => {
      const user = await requireUser();

      const dateFilter = getDateRangeFilter(timeRange);
      const baseQuery = supabase.from('fathom_calls').select('*', { count: 'exact', head: true }).eq('user_id', user.id);
      
      if (dateFilter) {
        baseQuery.gte('created_at', dateFilter.toISOString());
      }

      // Query 1: Total calls
      const { count: totalCalls } = await baseQuery;

      // Query 2: Average duration and total recording time
      const durationQuery = supabase
        .from('fathom_calls')
        .select('recording_start_time, recording_end_time')
        .eq('user_id', user.id)
        .not('recording_start_time', 'is', null)
        .not('recording_end_time', 'is', null);
      
      if (dateFilter) {
        durationQuery.gte('created_at', dateFilter.toISOString());
      }
      
      const { data: durationData } = await durationQuery;

      let avgDuration = 0;
      let totalMinutes = 0;
      if (durationData && durationData.length > 0) {
        const durations = durationData.map(call => {
          const start = new Date(call.recording_start_time!);
          const end = new Date(call.recording_end_time!);
          return (end.getTime() - start.getTime()) / 1000 / 60; // minutes
        });
        totalMinutes = durations.reduce((sum, d) => sum + d, 0);
        avgDuration = totalMinutes / durations.length;
      }

      const hours = Math.floor(totalMinutes / 60);
      const minutes = Math.floor(totalMinutes % 60);
      const totalRecordingTime = `${hours}h ${minutes}m`;

      // Query 3: Unique participants
      const { data: speakersData } = await supabase
        .from('call_speakers')
        .select('speaker_id, speakers!inner(user_id)')
        .eq('speakers.user_id', user.id);

      const uniqueParticipants = new Set(speakersData?.map(s => s.speaker_id) || []).size;

      // Query 4: Participation rate (speakers vs invitees)
      const inviteesQuery = supabase
        .from('fathom_calls')
        .select('recording_id, calendar_invitees')
        .eq('user_id', user.id)
        .not('calendar_invitees', 'is', null);
      
      if (dateFilter) {
        inviteesQuery.gte('created_at', dateFilter.toISOString());
      }
      
      const { data: callsWithInvitees } = await inviteesQuery;

      let totalInvitees = 0;
      let totalSpeakers = 0;
      if (callsWithInvitees) {
        totalInvitees = callsWithInvitees.reduce((sum, call) => {
          const invitees = call.calendar_invitees as Array<{ email: string; name?: string }> | null;
          return sum + (invitees?.length || 0);
        }, 0);

        const { count: speakersCount } = await supabase
          .from('call_speakers')
          .select('*', { count: 'exact', head: true })
          .in('call_recording_id', callsWithInvitees.map(c => c.recording_id));
        
        totalSpeakers = speakersCount || 0;
      }

      const participationRate = totalInvitees > 0 ? Math.round((totalSpeakers / totalInvitees) * 100) : 0;

      // Query 5: Active tags (system tags like TEAM, etc.)
      const { data: tagsData } = await supabase
        .from('call_tag_assignments')
        .select('tag_id, call_tags!inner(user_id)')
        .eq('call_tags.user_id', user.id);

      const activeFolders = new Set(tagsData?.map(c => c.tag_id) || []).size;

      // Query 6: Calls by tag
      const { data: callsByTagAssignmentData } = await supabase
        .from('call_tag_assignments')
        .select('tag_id, call_tags!inner(name, user_id)')
        .eq('call_tags.user_id', user.id);

      const tagAssignmentGroups = (callsByTagAssignmentData || []).reduce((acc, item) => {
        const name = (item.call_tags as { name: string }).name;
        acc[name] = (acc[name] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const callsByFolder = Object.entries(tagAssignmentGroups)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);

      // Query 7: Calls by tag
      const { data: callsByTagData } = await supabase
        .from('transcript_tag_assignments')
        .select('tag_id, transcript_tags!inner(name, user_id)')
        .eq('transcript_tags.user_id', user.id);

      const tagGroups = (callsByTagData || []).reduce((acc, item) => {
        const name = (item.transcript_tags as { name: string }).name;
        acc[name] = (acc[name] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const callsByTag = Object.entries(tagGroups)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);

      // Query 8: Call type distribution
      const callTypeQuery = supabase
        .from('fathom_calls')
        .select('calendar_invitees')
        .eq('user_id', user.id);
      
      if (dateFilter) {
        callTypeQuery.gte('created_at', dateFilter.toISOString());
      }
      
      const { data: callTypeData } = await callTypeQuery;

      const typeGroups = { External: 0, Internal: 0, Mixed: 0 };
      (callTypeData || []).forEach(call => {
        const invitees = (call.calendar_invitees as Array<{ external?: boolean }> | null) || [];
        const hasExternal = invitees.some((inv) => inv.external === true);
        const hasInternal = invitees.some((inv) => inv.external === false);

        if (hasExternal && hasInternal) typeGroups.Mixed++;
        else if (hasExternal) typeGroups.External++;
        else typeGroups.Internal++;
      });

      const callTypeDistribution = Object.entries(typeGroups)
        .filter(([_, value]) => value > 0)
        .map(([name, value]) => ({ name, value }));

      // Query 9: Monthly distribution
      const startDate = dateFilter || (() => {
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        return sixMonthsAgo;
      })();

      const monthlyQuery = supabase
        .from('fathom_calls')
        .select('created_at')
        .eq('user_id', user.id)
        .gte('created_at', startDate.toISOString());

      const { data: monthlyData } = await monthlyQuery;

      const monthGroups = (monthlyData || []).reduce((acc, call) => {
        const date = new Date(call.created_at);
        const monthKey = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        acc[monthKey] = (acc[monthKey] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const monthlyDistribution = Object.entries(monthGroups)
        .map(([name, value]) => ({ name, value }))
        .slice(-6);

      // Query 10: Duration breakdown
      const durationGroups = { '< 15 min': 0, '15-30 min': 0, '30-60 min': 0, '> 60 min': 0 };
      (durationData || []).forEach(call => {
        const start = new Date(call.recording_start_time!);
        const end = new Date(call.recording_end_time!);
        const minutes = (end.getTime() - start.getTime()) / 1000 / 60;
        
        if (minutes < 15) durationGroups['< 15 min']++;
        else if (minutes < 30) durationGroups['15-30 min']++;
        else if (minutes < 60) durationGroups['30-60 min']++;
        else durationGroups['> 60 min']++;
      });

      const durationBreakdown = Object.entries(durationGroups)
        .filter(([_, value]) => value > 0)
        .map(([name, value]) => ({ name, value }));

      // Query 11: Invitees vs Participants
      const inviteesVsParticipants = [
        { name: 'Invited', value: Math.max(0, totalInvitees - totalSpeakers) },
        { name: 'Participated', value: totalSpeakers }
      ].filter(item => item.value > 0);

      return {
        totalCalls: totalCalls || 0,
        participationRate,
        avgDuration,
        totalRecordingTime,
        uniqueParticipants,
        activeFolders,
        callsByFolder,
        callsByTag,
        callTypeDistribution,
        monthlyDistribution,
        durationBreakdown,
        inviteesVsParticipants
      };
    }
  });
}
