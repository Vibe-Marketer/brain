import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import type { Category } from "@/hooks/useCategorySync";

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
  meetings: any[];
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
  const [categories, setCategories] = useState<Category[]>([]);
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

  // Load categories from call_categories table
  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from("call_categories")
        .select("id, name")
        .order("name");

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      logger.error("Error loading categories", error);
    }
  };

  // Background sync job polling - checks for active sync jobs periodically
  useEffect(() => {
    let isMounted = true;
    let consecutiveEmptyChecks = 0;

    const checkActiveSyncJobs = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !isMounted) return;

        const { data } = await supabase
          .from('sync_jobs')
          .select('*')
          .eq('user_id', user.id)
          .in('status', ['pending', 'processing'])
          .order('created_at', { ascending: false });

        if (!isMounted) return;

        if (data && data.length > 0) {
          setActiveSyncJobs(data);
          consecutiveEmptyChecks = 0;
        } else {
          consecutiveEmptyChecks++;

          setActiveSyncJobs(prev => {
            if (prev.length > 0) {
              // Sync jobs just completed: refresh transcript list and sync status once
              setTimeout(() => loadExistingTranscripts(), 100);
              if (meetings.length > 0) {
                setTimeout(() => {
                  checkSyncStatus(meetings.map(m => m.recording_id));
                }, 200);
              }
            }
            return [];
          });

          // Force an additional refresh after a couple of empty checks
          if (consecutiveEmptyChecks === 2) {
            loadExistingTranscripts();
            if (meetings.length > 0) {
              checkSyncStatus(meetings.map(m => m.recording_id));
            }
          }
        }
      } catch (error) {
        logger.error('Error checking sync jobs', error);
      }
    };

    // Check immediately on mount
    checkActiveSyncJobs();

    // Poll every 10 seconds (reduced from 2s to avoid noisy polling)
    const interval = setInterval(checkActiveSyncJobs, 10000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [meetings, loadExistingTranscripts, checkSyncStatus]);

  // Load initial data on mount
  useEffect(() => {
    loadUserTimezone();
    loadHostEmail();
    loadCategories();
  }, []);

  return {
    userTimezone,
    hostEmail,
    categories,
    activeSyncJobs,
    setCategories,
    setActiveSyncJobs,
  };
}
