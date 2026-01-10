import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import {
  RiLoader2Line,
  RiSparklingLine,
  RiRobot2Line,
} from "@remixicon/react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { embedAllUnindexedTranscripts } from "@/lib/api-client";
import { supabase } from "@/integrations/supabase/client";
import { getSafeUser } from "@/lib/auth-utils";
import { AdminModelManager } from "./AdminModelManager";
import { Label } from "@/components/ui/label";
import { useAvailableModels } from "@/components/chat/model-selector";

interface IndexingStats {
  totalChunks: number;
  lastIndexedDate: string | null;
  totalRecordings: number;
  unindexedRecordings: number;
}

interface EmbeddingJob {
  id: string;
  status: "pending" | "running" | "completed" | "failed" | "completed_with_errors";
  progress_current: number;
  progress_total: number;
  chunks_created: number;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  // Queue-based tracking columns
  queue_total?: number;
  queue_completed?: number;
  queue_failed?: number;
}

export default function AITab() {
  const [indexing, setIndexing] = useState(false);
  const [stats, setStats] = useState<IndexingStats>({
    totalChunks: 0,
    lastIndexedDate: null,
    totalRecordings: 0,
    unindexedRecordings: 0,
  });
  const [loading, setLoading] = useState(true);
  const [activeJob, setActiveJob] = useState<EmbeddingJob | null>(null);

  // Dynamic Model Loading
  const { models, defaultModel: systemDefault, isLoading: modelsLoading } = useAvailableModels();

  const [selectedModel, setSelectedModel] = useState<string>(""); // Initialize empty, set after load
  
  // Group models by provider
  const modelGroups = useMemo(() => {
    const groups: Record<string, typeof models> = {};
    models.forEach(model => {
      const provider = model.provider || 'Other';
      if (!groups[provider]) groups[provider] = [];
      groups[provider].push(model);
    });
    return groups;
  }, [models]);

  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'ADMIN' });
      setIsAdmin(!!data);
    };
    checkAdmin();
  }, []);
  
  const [savedModel, setSavedModel] = useState("");
  const [modelSaving, setModelSaving] = useState(false);

  // Map legacy preset values to new ID format if needed
  const mapLegacyPreset = (preset: string): string => {
    const legacyMap: Record<string, string> = {
      'openai': 'openai/gpt-4o',
      'fast': 'openai/gpt-4o-mini',
      'quality': 'openai/gpt-4.1',
      'best': 'anthropic/claude-3-5-sonnet',
      'anthropic': 'anthropic/claude-3-5-sonnet',
      'google': 'google/gemini-2.0-flash',
      'balanced': 'openai/gpt-4o',
    };
    return legacyMap[preset] || preset;
  };

  const checkJobStatus = useCallback(async (jobId: string) => {
    try {
      const { data: job } = await supabase
        .from("embedding_jobs")
        .select("id, status, progress_current, progress_total, chunks_created, error_message, started_at, completed_at, queue_total, queue_completed, queue_failed")
        .eq("id", jobId)
        .single();

      if (job) {
        setActiveJob(job as EmbeddingJob);

        if (job.status === "completed") {
          toast.success(
            `Indexing complete! ${job.chunks_created} chunks created from ${job.progress_total} recordings.`
          );
          setIndexing(false);
          setActiveJob(null);
        } else if (job.status === "completed_with_errors") {
          const failedCount = job.queue_failed || 0;
          toast.warning(
            `Indexing completed with ${failedCount} failed recording${failedCount !== 1 ? "s" : ""}. ${job.chunks_created} chunks created.`
          );
          setIndexing(false);
          setActiveJob(null);
        } else if (job.status === "failed") {
          toast.error(`Indexing failed: ${job.error_message || "Unknown error"}`);
          setIndexing(false);
          setActiveJob(null);
        }
      }
    } catch (error) {
      logger.error("Error checking job status", error);
    }
  }, []);

  const loadIndexingStats = useCallback(async () => {
    try {
      setLoading(true);
      const { user, error: authError } = await getSafeUser();
      if (authError || !user) return;

      // Get indexed count using RPC function (avoids Supabase 1000 row limit bug)
      const { data: indexedStats, error: indexedError } = await supabase
        .rpc("get_indexed_recording_count", { p_user_id: user.id });

      if (indexedError) {
        logger.error("Error getting indexed count", indexedError);
      }

      const indexedCount = indexedStats?.[0]?.indexed_count || 0;
      const totalChunks = indexedStats?.[0]?.total_chunks || 0;

      // Get last indexed date
      const { data: lastChunk } = await supabase
        .from("transcript_chunks")
        .select("created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Get total recordings WITH transcripts (only these can be indexed)
      const { count: totalRecordings } = await supabase
        .from("fathom_calls")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .not("full_transcript", "is", null);

      setStats({
        totalChunks: totalChunks,
        lastIndexedDate: lastChunk?.created_at || null,
        totalRecordings: totalRecordings || 0,
        unindexedRecordings: (totalRecordings || 0) - indexedCount,
      });

      // Check for active jobs
      const { data: jobs } = await supabase
        .from("embedding_jobs")
        .select("id, status, progress_current, progress_total, chunks_created, error_message, started_at, completed_at, queue_total, queue_completed, queue_failed")
        .eq("user_id", user.id)
        .in("status", ["pending", "running"])
        .order("created_at", { ascending: false })
        .limit(1);

      if (jobs && jobs.length > 0) {
        setActiveJob(jobs[0] as EmbeddingJob);
        setIndexing(true);
      }

      // Load saved AI model preference
      const { data: settings } = await supabase
        .from("user_settings")
        .select("ai_model_preset")
        .eq("user_id", user.id)
        .maybeSingle();

      if (settings?.ai_model_preset) {
        const mapped = mapLegacyPreset(settings.ai_model_preset);
        setSelectedModel(mapped);
        setSavedModel(mapped);
      } else {
         // No setting? Use system default
         // Note: We might need to wait for `models` to load to know the true system default, 
         // but `systemDefault` from hook handles that.
      }
    } catch (error) {
      logger.error("Error loading indexing stats", error);
      toast.error("Failed to load indexing statistics");
    } finally {
      setLoading(false);
    }
  }, []); // Re-run if systemDefault changes? No, load once.

  // Sync selectedModel with systemDefault if nothing selected yet, OR if selected is invalid
  useEffect(() => {
    // 1. If nothing selected, set default
    if (!selectedModel && systemDefault) {
      setSelectedModel(systemDefault);
    } 
    // 2. If selected but not in list (and list is loaded), reset to default
    else if (selectedModel && models.length > 0 && !modelsLoading) {
       const isValid = models.find(m => m.id === selectedModel);
       if (!isValid) {
         console.warn(`Selected model ${selectedModel} invalid. Resetting to default.`);
         // Prevent infinite loop if systemDefault is also somehow invalid (unlikely)
         if (systemDefault && models.find(m => m.id === systemDefault)) {
            setSelectedModel(systemDefault);
         } else if (models.length > 0) {
            setSelectedModel(models[0].id);
         }
       }
    }
  }, [selectedModel, systemDefault, models, modelsLoading]);

  // Save AI model preference
  const handleModelChange = async (newModel: string) => {
    setSelectedModel(newModel);
    setModelSaving(true);

    try {
      const { user, error: authError } = await getSafeUser();
      if (authError || !user) {
        toast.error("Not authenticated");
        setSelectedModel(savedModel);
        return;
      }

      const { error } = await supabase
        .from("user_settings")
        .upsert(
          { user_id: user.id, ai_model_preset: newModel },
          { onConflict: "user_id" }
        );

      if (error) {
        logger.error("Error saving model preference", error);
        toast.error("Failed to save model preference");
        setSelectedModel(savedModel);
      } else {
        setSavedModel(newModel);
        const modelName = models.find(m => m.id === newModel)?.name || newModel;
        toast.success(`AI model updated to ${modelName}`);
      }
    } catch (error) {
      logger.error("Error saving model preference", error);
      toast.error("Failed to save model preference");
      setSelectedModel(savedModel);
    } finally {
      setModelSaving(false);
    }
  };

  // Load stats on mount
  useEffect(() => {
    loadIndexingStats();
  }, [loadIndexingStats]);

  // ... (keeping existing job polling effects) ...
  // Poll for active job status with proper cleanup
  useEffect(() => {
    if (!activeJob || (activeJob.status !== "pending" && activeJob.status !== "running")) {
      return;
    }

    const interval = setInterval(() => {
      checkJobStatus(activeJob.id);
    }, 2000);

    return () => clearInterval(interval);
  }, [activeJob, checkJobStatus]);

  // Refresh stats when job completes
  useEffect(() => {
    if (activeJob?.status === "completed" || activeJob?.status === "completed_with_errors") {
      loadIndexingStats();
    }
  }, [activeJob?.status, loadIndexingStats]);

  const handleIndexTranscripts = async () => {
     // ... (existing implementation) ...
    try {
      setIndexing(true);
      logger.info("Starting transcript indexing...");
      toast.info("Starting transcript indexing...");

      const response = await embedAllUnindexedTranscripts();

      if (response.error) {
        logger.error("Indexing failed", response.error);
        toast.error(`Indexing failed: ${response.error}`);
        setIndexing(false);
        return;
      }

      if (response.data) {
        const { job_id, recordings_processed } = response.data;

        logger.info("Indexing started", { job_id, recordings_processed });
        toast.success(`Indexing ${recordings_processed} transcripts...`);

        if (job_id) {
          const { data: job } = await supabase
            .from("embedding_jobs")
            .select("id, status, progress_current, progress_total, chunks_created, error_message, started_at, completed_at, queue_total, queue_completed, queue_failed")
            .eq("id", job_id)
            .single();

          if (job) {
            setActiveJob(job as EmbeddingJob);
          }
        }
      }
    } catch (error) {
      logger.error("Indexing error", error);
      toast.error("Indexing failed: " + (error instanceof Error ? error.message : "Unknown error"));
      setIndexing(false);
    }
  };

  const getProgressPercentage = () => {
    if (!activeJob || activeJob.progress_total === 0) return 0;
    return Math.round((activeJob.progress_current / activeJob.progress_total) * 100);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RiLoader2Line className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Get current model details for display
  const currentModelDetails = models.find(m => m.id === selectedModel);

  return (
    <div>
      <Separator className="mb-12" />

      {/* AI Model Configuration Section */}
      <div className="space-y-4 mb-12">
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-gray-50">
            AI Model Configuration
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">
            Choose the AI model used for metadata extraction and analysis
          </p>
        </div>

        {/* Model Selection Card */}
        <div className="relative py-6 px-6 bg-card border border-cb-border dark:border-cb-border-dark rounded-lg">
          <div
            className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-20 bg-vibe-orange"
            style={{
              clipPath: "polygon(0px 0px, 100% 10%, 100% 90%, 0px 100%)",
            }}
          />

          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 mt-1">
              <RiRobot2Line className="h-6 w-6 text-cb-ink-muted" />
            </div>

            <div className="flex-1 space-y-4">
            <div className="flex flex-col gap-2">
              <Label>Default Chat Model</Label>
              <Select
                value={selectedModel}
                  onValueChange={handleModelChange}
                  disabled={modelSaving || modelsLoading}
                >
                  <SelectTrigger className="w-full">
                    {modelSaving || modelsLoading ? (
                      <div className="flex items-center gap-2">
                        <RiLoader2Line className="h-4 w-4 animate-spin" />
                        <span>{modelSaving ? "Saving..." : "Loading Models..."}</span>
                      </div>
                    ) : (
                      <SelectValue placeholder="Select AI model">
                        {currentModelDetails ? (
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{currentModelDetails.name}</span>
                            <span className="text-muted-foreground">({currentModelDetails.provider})</span>
                          </div>
                        ) : (
                           selectedModel || "Select Model"
                        )}
                      </SelectValue>
                    )}
                  </SelectTrigger>
                   <SelectContent className="max-h-[400px]">
                    {Object.entries(modelGroups).map(([provider, providerModels]) => (
                      providerModels.length > 0 && (
                        <SelectGroup key={provider}>
                          <SelectLabel className="capitalize">{provider}</SelectLabel>
                          {providerModels.map((model) => (
                            <SelectItem key={model.id} value={model.id}>
                              <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{model.name}</span>
                                  {model.contextLength && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                      {Math.round(model.contextLength / 1000)}k
                                    </span>
                                  )}
                                </div>
                                <span className="text-xs text-muted-foreground">{model.id}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      )
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {currentModelDetails && (
                <div className="pt-3 border-t border-cb-border dark:border-cb-border-dark">
                  <p className="text-xs text-muted-foreground">
                    <strong>Current:</strong> {currentModelDetails.name} ({currentModelDetails.provider})
                     {currentModelDetails.pricing && ` · $${currentModelDetails.pricing.prompt}/1M input`}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Knowledge Base Indexing Section */}
      <div className="space-y-4">
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-gray-50">
            Knowledge Base Indexing
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">
            Index your call transcripts to enable AI-powered search and chat
          </p>
        </div>

        {/* Indexing Action Card */}
        <div className="relative py-6 px-6 bg-card border border-cb-border dark:border-cb-border-dark rounded-lg">
          <div
            className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-20 bg-vibe-orange"
            style={{
              clipPath: "polygon(0px 0px, 100% 10%, 100% 90%, 0px 100%)",
            }}
          />

          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 mt-1">
              <RiSparklingLine className="h-6 w-6 text-cb-ink-muted" />
            </div>

            <div className="flex-1 space-y-4">
              <div>
                <h3 className="font-medium text-gray-900 dark:text-gray-50">
                  Index All Transcripts
                </h3>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-500">
                  Automatically discover and index all unindexed call transcripts. Creates
                  embeddings for AI-powered semantic search and chat capabilities.
                </p>
                {stats.unindexedRecordings > 0 && (
                  <p className="mt-2 text-sm font-medium text-vibe-orange">
                    {stats.unindexedRecordings} transcript{stats.unindexedRecordings !== 1 ? "s" : ""} ready to index
                  </p>
                )}
              </div>

              {/* Progress Bar */}
              {activeJob && (activeJob.status === "pending" || activeJob.status === "running") && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Processing {activeJob.progress_current} of {activeJob.progress_total}
                      {(activeJob.queue_failed ?? 0) > 0 && (
                        <span className="text-amber-600 dark:text-amber-400 ml-2">
                          ({activeJob.queue_failed} failed)
                        </span>
                      )}
                    </span>
                    <span className="font-medium tabular-nums">{getProgressPercentage()}%</span>
                  </div>
                  <div className="w-full bg-cb-border dark:bg-cb-border-dark rounded-full h-2">
                    <div
                      className="bg-vibe-orange h-2 rounded-full transition-all duration-300"
                      style={{ width: `${getProgressPercentage()}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {activeJob.chunks_created} chunks created so far
                  </p>
                </div>
              )}

              <div className="flex items-center gap-3">
                <Button
                  onClick={handleIndexTranscripts}
                  disabled={indexing || stats.unindexedRecordings === 0}
                  className="gap-2"
                >
                  {indexing ? (
                    <>
                      <RiLoader2Line className="h-4 w-4 animate-spin" />
                      Indexing Transcripts...
                    </>
                  ) : (
                    <>
                      <RiSparklingLine className="h-4 w-4" />
                      Index All Transcripts
                    </>
                  )}
                </Button>

                {indexing && activeJob && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={async () => {
                      try {
                        const { error } = await supabase
                          .from("embedding_jobs")
                          .update({ 
                            status: "failed", 
                            error_message: "Cancelled by user",
                            completed_at: new Date().toISOString()
                          })
                          .eq("id", activeJob.id);

                        if (error) throw error;
                        
                        toast.success("Indexing cancelled");
                        setIndexing(false);
                        setActiveJob(null);
                        loadIndexingStats();
                      } catch (err) {
                        toast.error("Failed to cancel job");
                        logger.error("Cancel job error", err);
                      }
                    }}
                  >
                    Cancel
                  </Button>
                )}

                {stats.unindexedRecordings === 0 && (
                  <p className="text-sm text-muted-foreground">
                    All transcripts are indexed
                  </p>
                )}
              </div>

              <div className="pt-3 border-t border-cb-border dark:border-cb-border-dark">
                <p className="text-xs text-muted-foreground">
                  <strong>How it works:</strong> The indexing process breaks transcripts into
                  searchable chunks and creates vector embeddings for semantic search. This
                  enables AI chat to understand context and find relevant information across
                  all your calls.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isAdmin && (
        <div className="mt-12 pt-12 border-t border-border">
          <AdminModelManager />
        </div>
      )}
    </div>
  );
}
