import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import {
  RiMagicLine,
  RiPriceTag3Line,
  RiCheckboxCircleLine,
  RiErrorWarningLine,
  RiLoader4Line,
} from "@remixicon/react";
import { logger } from "@/lib/logger";

interface AIJob {
  id: string;
  job_type: 'title_generation' | 'auto_tagging';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress_current: number;
  progress_total: number;
  success_count: number;
  error_message?: string;
  created_at: string;
}

interface AIProcessingProgressProps {
  onJobsComplete?: () => void;
}

export const AIProcessingProgress = ({ onJobsComplete }: AIProcessingProgressProps) => {
  const [activeJobs, setActiveJobs] = useState<AIJob[]>([]);

  useEffect(() => {
    let isMounted = true;

    const checkActiveJobs = async () => {
      try {
        const { data, error } = await supabase
          .from('ai_processing_jobs')
          .select('*')
          .in('status', ['pending', 'processing'])
          .order('created_at', { ascending: false });

        if (error) throw error;

        if (!isMounted) return;

        logger.info('Active AI jobs check:', { count: data?.length || 0 });

        if (data && data.length > 0) {
          setActiveJobs(data as AIJob[]);
        } else {
          setActiveJobs(prev => {
            if (prev.length > 0 && onJobsComplete) {
              logger.info('AI jobs completed, triggering callback');
              setTimeout(() => onJobsComplete(), 100);
            }
            return [];
          });
        }
      } catch (error) {
        logger.error('Error checking AI jobs', error);
      }
    };

    checkActiveJobs();
    const interval = setInterval(checkActiveJobs, 2000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [onJobsComplete]);

  if (activeJobs.length === 0) return null;

  return (
    <div className="space-y-3 mb-4">
      {activeJobs.map((job) => {
        const percentage = job.progress_total > 0 
          ? Math.round((job.progress_current / job.progress_total) * 100)
          : 0;

        const Icon = job.job_type === 'title_generation' ? RiMagicLine : RiPriceTag3Line;
        const label = job.job_type === 'title_generation' ? 'Generating Titles' : 'Auto-Tagging Calls';

        return (
          <div
            key={job.id}
            className="bg-white dark:bg-cb-black border border-cb-black dark:border-cb-white rounded-lg p-4 shadow-sm"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                {job.status === 'processing' ? (
                  <RiLoader4Line className="h-4 w-4 animate-spin text-cb-green" />
                ) : job.status === 'failed' ? (
                  <RiErrorWarningLine className="h-4 w-4 text-red-500" />
                ) : (
                  <Icon className="h-4 w-4 text-cb-black dark:text-cb-white" />
                )}
                <div>
                  <h3 className="font-semibold text-sm text-cb-black dark:text-cb-white">
                    {label}
                  </h3>
                  <p className="text-xs text-cb-gray-dark dark:text-cb-gray-light">
                    {job.status === 'processing' 
                      ? `Processing ${job.progress_current} of ${job.progress_total} calls...`
                      : job.status === 'failed'
                      ? 'Failed - check logs'
                      : `Queued: ${job.progress_total} calls`
                    }
                  </p>
                </div>
              </div>

              {job.status === 'processing' && (
                <div className="text-right">
                  <div className="text-lg font-bold text-cb-green">{percentage}%</div>
                  <div className="text-xs text-cb-gray-dark dark:text-cb-gray-light">
                    {job.success_count} completed
                  </div>
                </div>
              )}
            </div>

            {job.status === 'processing' && (
              <Progress 
                value={percentage} 
                className="h-2"
              />
            )}

            {job.error_message && (
              <div className="mt-2 text-xs text-red-600 dark:text-red-400">
                Error: {job.error_message}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
