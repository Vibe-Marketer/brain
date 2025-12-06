import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import type { Tag } from "@/hooks/useCategorySync";

interface SyncJob {
  id: string;
  user_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  error_message: string | null;
  recording_ids: number[];
  progress_current: number;
  progress_total: number;
  synced_ids: number[] | null;
  failed_ids: number[] | null;
}

interface UseSyncTabStateProps {
  meetings: Array<{ recording_id: string }>;
  loadExistingTranscripts: () => Promise<void>;
  checkSyncStatus: (recordingIds: string[]) => Promise<void>;
}

export function useSyncTabState({
  meetings,
  loadExistingTranscripts,
  checkSyncStatus
}: UseSyncTabStateProps) {
  const [userTimezone, setUserTimezone] = useState<string>("America/New_York");
  const [hostEmail, setHostEmail] = useState<string>("");
  const [tags, setTags] = useState<Tag[]>([]);
  const [activeSyncJobs, setActiveSyncJobs] = useState<SyncJob[]>([]);

  // Load user timezone from user_settings
  const loadUserTimezone = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { data: settings } = await supabase
          .from('user_settings')
          .select('timezone')
          .eq('user_id', user.id)
          .maybeSingle();

        if (settings?.timezone) {
          setUserTimezone(settings.timezone);
        }
      }
    } catch (error) {
      logger.error('Error loading timezone', error);
    }
  };

  // Load host email from user_settings
  const loadHostEmail = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { data: settings } = await supabase
          .from('user_settings')
          .select('host_email')
          .eq('user_id', user.id)
          .maybeSingle();

        if (settings?.host_email) {
          setHostEmail(settings.host_email);
        }
      }
    } catch (error) {
      logger.error('Error loading host email', error);
    }
  };

  // Load tags from call_tags table
  const loadTags = async () => {
    try {
      const { data, error } = await supabase
        .from("call_tags")
        .select("id, name")
        .order("name");

      if (error) throw error;
      setTags(data || []);
    } catch (error) {
      logger.error("Error loading tags", error);
    }
  };

  // Background sync job polling - polls for active sync jobs and updates UI
  useEffect(() => {
    let pollInterval: NodeJS.Timeout | null = null;
    let isMounted = true;

    const pollSyncJobs = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !isMounted) return;

        // Fetch active sync jobs (pending or processing)
        const { data: jobs, error } = await supabase
          .from('sync_jobs')
          .select('*')
          .eq('user_id', user.id)
          .in('status', ['pending', 'processing'])
          .order('created_at', { ascending: false });

        if (error) {
          logger.error('Error polling sync jobs', error);
          return;
        }

        if (!isMounted) return;

        // Update active sync jobs state
        setActiveSyncJobs(jobs || []);

        // If no active jobs, stop polling
        if (!jobs || jobs.length === 0) {
          if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
          }
          return;
        }
      } catch (error) {
        logger.error('Error in sync job polling', error);
      }
    };

    // Initial poll
    pollSyncJobs();

    // Start polling if there are active jobs
    pollInterval = setInterval(pollSyncJobs, 2000);

    // Cleanup
    return () => {
      isMounted = false;
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, []);

  // Refresh transcripts when a sync job completes
  useEffect(() => {
    let previousJobs: SyncJob[] = [];

    const checkForCompletedJobs = async () => {
      // Find jobs that were previously in activeSyncJobs but are now missing (completed)
      if (previousJobs.length > 0 && activeSyncJobs.length === 0) {
        // At least one job completed - refresh data
        await loadExistingTranscripts();
        if (meetings.length > 0) {
          await checkSyncStatus(meetings.map(m => m.recording_id));
        }
      }
      previousJobs = [...activeSyncJobs];
    };

    checkForCompletedJobs();
  }, [activeSyncJobs, meetings, loadExistingTranscripts, checkSyncStatus]);

  // Load initial data on mount
  useEffect(() => {
    loadUserTimezone();
    loadHostEmail();
    loadTags();
  }, []);

  return {
    userTimezone,
    hostEmail,
    tags,
    activeSyncJobs,
    setTags,
    setActiveSyncJobs,
    // Backward-compatible aliases
    categories: tags,
    setCategories: setTags,
  };
}
