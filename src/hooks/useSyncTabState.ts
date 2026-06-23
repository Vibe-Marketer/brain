import { useState, useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { getSafeUser } from "@/lib/auth-utils";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
import { queryKeys } from "@/lib/query-config";
import type { Tag } from "@/hooks/useCategorySync";
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface SyncJob {
  id: string;
  user_id: string;
  status: string;
  type?: string;
  created_at: string;
  updated_at: string;
  started_at?: string | null;
  completed_at: string | null;
  error: string | null;
  metadata?: unknown; // Json type from Supabase can be string | number | boolean | null | object | array
  recording_ids: number[];
  progress_current: number;
  progress_total: number;
  synced_ids: number[] | null;
  failed_ids: number[] | null;
}

interface UseSyncTabStateProps {
  meetings: Array<{ recording_id: string }>;
  loadExistingTranscripts: () => Promise<void>;
  checkSyncStatus: (sourceApp: string, recordingIds: string[]) => Promise<void>;
  setMeetings?: (meetings: Array<{ recording_id: string }> | ((prev: Array<{ recording_id: string }>) => Array<{ recording_id: string }>)) => void;
}

export function useSyncTabState({
  meetings,
  loadExistingTranscripts,
  checkSyncStatus,
  setMeetings
}: UseSyncTabStateProps) {
  const { activeOrgId } = useOrganizationContext();
  const queryClient = useQueryClient();
  const [userTimezone, setUserTimezone] = useState<string>("America/New_York");
  const [hostEmail, setHostEmail] = useState<string>("");
  const [tags, setTags] = useState<Tag[]>([]);
  const [activeSyncJobs, setActiveSyncJobs] = useState<SyncJob[]>([]);
  const [recentlyCompletedJobs, setRecentlyCompletedJobs] = useState<SyncJob[]>([]);
  const recentlyCompletedJobsRef = useRef<SyncJob[]>([]);
  const realtimeChannelRef = useRef<RealtimeChannel | null>(null);
  const completedJobTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const processedSyncedIdsRef = useRef<Set<number>>(new Set());
  
  // Refs for callbacks to avoid dependency loops in useEffect
  const loadExistingTranscriptsRef = useRef(loadExistingTranscripts);
  const checkSyncStatusRef = useRef(checkSyncStatus);
  const setMeetingsRef = useRef(setMeetings);
  const meetingsRef = useRef(meetings);
  
  // Keep refs updated
  loadExistingTranscriptsRef.current = loadExistingTranscripts;
  checkSyncStatusRef.current = checkSyncStatus;
  setMeetingsRef.current = setMeetings;
  meetingsRef.current = meetings;

  useEffect(() => {
    recentlyCompletedJobsRef.current = recentlyCompletedJobs;
  }, [recentlyCompletedJobs]);

  // Load user timezone from user_settings
  const loadUserTimezone = useCallback(async () => {
    try {
      const { user, error: authError } = await getSafeUser();
      if (authError || !user) return;

      const { data: settings } = await supabase
        .from('user_settings')
        .select('timezone')
        .eq('user_id', user.id)
        .maybeSingle();

      if (settings?.timezone) {
        setUserTimezone(settings.timezone);
      }
    } catch (error) {
      logger.error('Error loading timezone', error);
    }
  }, []);

  // Load host email from user_settings
  const loadHostEmail = useCallback(async () => {
    try {
      const { user, error: authError } = await getSafeUser();
      if (authError || !user) return;

      const { data: settings } = await supabase
        .from('user_settings')
        .select('host_email')
        .eq('user_id', user.id)
        .maybeSingle();

      if (settings?.host_email) {
        setHostEmail(settings.host_email);
      }
    } catch (error) {
      logger.error('Error loading host email', error);
    }
  }, []);

  // Load tags from call_tags table (scoped to active workspace)
  const loadTags = useCallback(async () => {
    try {
      let query = supabase
        .from("call_tags")
        .select("id, name")
        .order("name");

      if (activeOrgId) {
        query = query.eq("organization_id", activeOrgId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setTags(data || []);
    } catch (error) {
      logger.error("Error loading tags", error);
    }
  }, [activeOrgId]);

  // Progressively remove synced meetings as they complete
  // Uses refs to avoid being a dependency that triggers effect re-runs
  const removeNewlySyncedMeetings = useCallback((job: SyncJob) => {
    const setMeetingsFn = setMeetingsRef.current;
    if (!setMeetingsFn || !job.synced_ids) return;

    // Find IDs that are newly synced (not already processed)
    const newlySyncedIds = job.synced_ids.filter(id => !processedSyncedIdsRef.current.has(id));

    if (newlySyncedIds.length > 0) {
      // Mark these IDs as processed
      newlySyncedIds.forEach(id => processedSyncedIdsRef.current.add(id));

      // Remove from unsynced list
      const syncedIdStrings = new Set(newlySyncedIds.map(id => String(id)));
      setMeetingsFn(prev => prev.filter(m => !syncedIdStrings.has(m.recording_id)));

      logger.debug(`Removed ${newlySyncedIds.length} newly synced meetings from unsynced list`);
    }
  }, []); // No dependencies - uses refs

  // Handle job completion - show success state and refresh data
  // Uses refs to avoid being a dependency that triggers effect re-runs
  const handleJobCompleted = useCallback(async (job: SyncJob) => {
    if (recentlyCompletedJobsRef.current.some((recentJob) => recentJob.id === job.id)) {
      return;
    }

    logger.info(`Sync job ${job.id} completed with status: ${job.status}`);

    // Clear processed IDs for this completed job
    processedSyncedIdsRef.current.clear();

    // Remove from active jobs
    setActiveSyncJobs(prev => prev.filter(j => j.id !== job.id));

    // Add to recently completed (will show success message)
    setRecentlyCompletedJobs(prev => {
      if (prev.some((recentJob) => recentJob.id === job.id)) return prev;
      const next = [...prev, job];
      recentlyCompletedJobsRef.current = next;
      return next;
    });

    // Auto-remove completed job after 8 seconds
    const timeoutId = setTimeout(() => {
      setRecentlyCompletedJobs(prev => {
        const next = prev.filter(j => j.id !== job.id);
        recentlyCompletedJobsRef.current = next;
        return next;
      });
      completedJobTimeoutsRef.current.delete(job.id);
    }, 8000);
    completedJobTimeoutsRef.current.set(job.id, timeoutId);

    // Refresh the data using ref
    await loadExistingTranscriptsRef.current();

    // Invalidate failed imports so false-positives clear immediately
    queryClient.invalidateQueries({ queryKey: queryKeys.imports.failed() });

    // Remove synced meetings from unsynced list using ref
    const setMeetingsFn = setMeetingsRef.current;
    if (setMeetingsFn && job.synced_ids && job.synced_ids.length > 0) {
      const syncedIdStrings = new Set(job.synced_ids.map(id => String(id)));
      setMeetingsFn(prev => prev.filter(m => !syncedIdStrings.has(m.recording_id)));
    }

    // Check sync status for remaining meetings using ref
    const currentMeetings = meetingsRef.current;
    if (currentMeetings.length > 0) {
      // PHASE 27 CARRY-FORWARD (26-04 / TBL-03): this hook is PRESERVED for the
      // Phase 27 job-status seam, but it still hardcodes sourceApp "fathom" here.
      // The live import path was fixed via the new <ImportSurface> overlay
      // (real per-row source_app + organizationId), but this preserved file was
      // NOT rewired. Phase 27 MUST thread a real source_app (and organizationId)
      // when it re-integrates useSyncTabState into the new surface — otherwise
      // non-Fathom rows read as unsynced forever (Pitfall 2 / CR-02 / WR-02).
      await checkSyncStatusRef.current("fathom", currentMeetings.map(m => m.recording_id));
    }
  }, [queryClient]); // queryClient from TanStack is a stable singleton — safe to add

  // Hybrid approach: Try realtime with polling fallback
  useEffect(() => {
    let isMounted = true;
    let pollInterval: NodeJS.Timeout | null = null;
    let _realtimeConnected = false;
    let previousJobsRef: SyncJob[] = [];
    const completedJobTimeouts = completedJobTimeoutsRef.current;

    const pollSyncJobs = async () => {
      try {
        const { user, error: authError } = await getSafeUser();
        if (authError || !user || !isMounted) return;

        const { data: jobs, error } = await supabase
          .from('sync_jobs')
          .select('*')
          .eq('user_id', user.id)
          .in('status', ['pending', 'processing', 'completed', 'failed', 'completed_with_errors'])
          .gte('updated_at', new Date(Date.now() - 60000).toISOString()) // Last minute
          .order('created_at', { ascending: false });

        if (error || !isMounted) return;

        const activeJobs = (jobs || []).filter(j =>
          j.status === 'pending' || j.status === 'processing'
        );

        // Check for newly completed jobs
        const completedJobs = (jobs || []).filter(j =>
          j.status === 'completed' || j.status === 'failed' || j.status === 'completed_with_errors'
        );

        // Progressively remove synced meetings for active jobs
        for (const activeJob of activeJobs) {
          removeNewlySyncedMeetings(activeJob);
        }

        // Find jobs that just completed (were in previousJobsRef but now are completed)
        for (const completedJob of completedJobs) {
          const wasActive = previousJobsRef.some(prev =>
            prev.id === completedJob.id &&
            (prev.status === 'pending' || prev.status === 'processing')
          );
          const alreadyHandled = recentlyCompletedJobsRef.current.some(r => r.id === completedJob.id);

          if (wasActive && !alreadyHandled) {
            await handleJobCompleted(completedJob);
          }
        }

        setActiveSyncJobs(activeJobs);
        previousJobsRef = jobs || [];
      } catch (error) {
        logger.error('Error polling sync jobs', error);
      }
    };

    const setupRealtimeSubscription = async () => {
      try {
        const { user, error: authError } = await getSafeUser();
        if (authError || !user || !isMounted) return;

        // Initial fetch
        await pollSyncJobs();

        // Try to set up realtime subscription
        const channel = supabase
          .channel(`sync_jobs_${user.id}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'sync_jobs',
              filter: `user_id=eq.${user.id}`,
            },
            async (payload) => {
              if (!isMounted) return;

              logger.debug('Sync job realtime update:', payload);
              _realtimeConnected = true;

              const newJob = payload.new as SyncJob;
              const oldJob = payload.old as SyncJob;

              if (payload.eventType === 'INSERT') {
                setActiveSyncJobs(prev => [newJob, ...prev]);
              } else if (payload.eventType === 'UPDATE') {
                if (newJob.status === 'completed' || newJob.status === 'failed' || newJob.status === 'completed_with_errors') {
                  await handleJobCompleted(newJob);
                } else {
                  // Progressively remove synced meetings during sync
                  removeNewlySyncedMeetings(newJob);
                  setActiveSyncJobs(prev =>
                    prev.map(j => j.id === newJob.id ? newJob : j)
                  );
                }
              } else if (payload.eventType === 'DELETE') {
                setActiveSyncJobs(prev => prev.filter(j => j.id !== oldJob.id));
              }
            }
          )
          .subscribe((status) => {
            logger.debug('Sync jobs realtime subscription status:', status);
            if (status === 'SUBSCRIBED') {
              _realtimeConnected = true;
              // Reduce polling frequency when realtime is connected
              if (pollInterval) {
                clearInterval(pollInterval);
                pollInterval = setInterval(pollSyncJobs, 10000); // Poll every 10s as backup
              }
            } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
              _realtimeConnected = false;
              // Increase polling frequency when realtime fails
              if (pollInterval) {
                clearInterval(pollInterval);
              }
              pollInterval = setInterval(pollSyncJobs, 2000); // Poll every 2s
            }
          });

        realtimeChannelRef.current = channel;

        // Start polling as fallback (will be adjusted when realtime connects)
        pollInterval = setInterval(pollSyncJobs, 2000);

      } catch (error) {
        logger.error('Error setting up sync jobs monitoring', error);
        // Fallback to polling only
        pollInterval = setInterval(pollSyncJobs, 2000);
      }
    };

    setupRealtimeSubscription();

    return () => {
      isMounted = false;
      if (pollInterval) clearInterval(pollInterval);
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
      }
      completedJobTimeouts.forEach(timeout => clearTimeout(timeout));
      completedJobTimeouts.clear();
    };
  }, [handleJobCompleted, removeNewlySyncedMeetings]);

  // Load initial data on mount
  useEffect(() => {
    loadUserTimezone();
    loadHostEmail();
    loadTags();
  }, [loadHostEmail, loadTags, loadUserTimezone]);

  return {
    userTimezone,
    hostEmail,
    tags,
    activeSyncJobs,
    recentlyCompletedJobs,
    setTags,
    setActiveSyncJobs,
    // Backward-compatible aliases
    categories: tags,
    setCategories: setTags,
  };
}
