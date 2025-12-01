import { useState, useEffect, useCallback } from "react";
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
  RiDatabaseLine,
  RiCheckboxCircleLine,
  RiSparklingLine,
  RiRobot2Line,
} from "@remixicon/react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { embedAllUnindexedTranscripts } from "@/lib/api-client";
import { supabase } from "@/integrations/supabase/client";

// AI Model presets - these map to the full model IDs used by the backend
// Format: value (preset key) -> label (display name) -> provider -> description
// The preset keys are used for user_settings storage, actual model IDs are resolved in backend
const AI_MODEL_PRESETS = [
  // OpenAI models
  { value: "openai/gpt-4.1", label: "GPT-4.1", provider: "OpenAI", description: "Latest flagship model" },
  { value: "openai/gpt-4o", label: "GPT-4o", provider: "OpenAI", description: "Most capable, multimodal" },
  { value: "openai/gpt-4o-mini", label: "GPT-4o Mini", provider: "OpenAI", description: "Fast and efficient" },
  { value: "openai/o1", label: "o1", provider: "OpenAI", description: "Advanced reasoning" },
  { value: "openai/o1-mini", label: "o1 Mini", provider: "OpenAI", description: "Fast reasoning" },
  { value: "openai/o3-mini", label: "o3 Mini", provider: "OpenAI", description: "Latest reasoning model" },
  // Anthropic models
  { value: "anthropic/claude-sonnet-4-20250514", label: "Claude Sonnet 4", provider: "Anthropic", description: "Latest Claude model" },
  { value: "anthropic/claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet", provider: "Anthropic", description: "Balanced quality & speed" },
  { value: "anthropic/claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku", provider: "Anthropic", description: "Fast and affordable" },
  { value: "anthropic/claude-3-opus-20240229", label: "Claude 3 Opus", provider: "Anthropic", description: "Most capable Claude 3" },
  // Google models
  { value: "google/gemini-2.0-flash", label: "Gemini 2.0 Flash", provider: "Google", description: "Fast multimodal" },
  { value: "google/gemini-2.0-flash-thinking", label: "Gemini 2.0 Flash Thinking", provider: "Google", description: "Reasoning model" },
  { value: "google/gemini-1.5-pro", label: "Gemini 1.5 Pro", provider: "Google", description: "Best for complex tasks" },
  { value: "google/gemini-1.5-flash", label: "Gemini 1.5 Flash", provider: "Google", description: "Fast and efficient" },
  // xAI models (Grok)
  { value: "xai/grok-3", label: "Grok 3", provider: "xAI", description: "Latest xAI model" },
  { value: "xai/grok-3-fast", label: "Grok 3 Fast", provider: "xAI", description: "Faster Grok 3" },
  { value: "xai/grok-2-1212", label: "Grok 2", provider: "xAI", description: "Powerful reasoning" },
  { value: "xai/grok-2-vision-1212", label: "Grok 2 Vision", provider: "xAI", description: "Multimodal Grok" },
  // Groq models (Fast inference)
  { value: "groq/llama-3.3-70b-versatile", label: "Llama 3.3 70B", provider: "Groq", description: "Fast Llama inference" },
  { value: "groq/llama-3.1-8b-instant", label: "Llama 3.1 8B", provider: "Groq", description: "Ultra-fast inference" },
  { value: "groq/mixtral-8x7b-32768", label: "Mixtral 8x7B", provider: "Groq", description: "Fast MoE model" },
  // Mistral models
  { value: "mistral/mistral-large-latest", label: "Mistral Large", provider: "Mistral", description: "Most capable Mistral" },
  { value: "mistral/mistral-small-latest", label: "Mistral Small", provider: "Mistral", description: "Fast and efficient" },
  { value: "mistral/codestral-latest", label: "Codestral", provider: "Mistral", description: "Optimized for code" },
  // DeepSeek models
  { value: "deepseek/deepseek-chat", label: "DeepSeek V3", provider: "DeepSeek", description: "Latest DeepSeek model" },
  { value: "deepseek/deepseek-reasoner", label: "DeepSeek R1", provider: "DeepSeek", description: "Reasoning model" },
  // Perplexity models
  { value: "perplexity/sonar-pro", label: "Sonar Pro", provider: "Perplexity", description: "Best for research" },
  { value: "perplexity/sonar", label: "Sonar", provider: "Perplexity", description: "Fast web search" },
] as const;

// Group presets by provider for display
const PRESET_GROUPS = {
  OpenAI: AI_MODEL_PRESETS.filter(p => p.provider === "OpenAI"),
  Anthropic: AI_MODEL_PRESETS.filter(p => p.provider === "Anthropic"),
  Google: AI_MODEL_PRESETS.filter(p => p.provider === "Google"),
  xAI: AI_MODEL_PRESETS.filter(p => p.provider === "xAI"),
  Groq: AI_MODEL_PRESETS.filter(p => p.provider === "Groq"),
  Mistral: AI_MODEL_PRESETS.filter(p => p.provider === "Mistral"),
  DeepSeek: AI_MODEL_PRESETS.filter(p => p.provider === "DeepSeek"),
  Perplexity: AI_MODEL_PRESETS.filter(p => p.provider === "Perplexity"),
};

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

  // AI Model selection state - default to GPT-4o
  const [selectedModel, setSelectedModel] = useState("openai/gpt-4o");
  const [savedModel, setSavedModel] = useState("openai/gpt-4o");
  const [modelSaving, setModelSaving] = useState(false);

  // Map legacy preset values to new format
  const mapLegacyPreset = (preset: string): string => {
    const legacyMap: Record<string, string> = {
      'openai': 'openai/gpt-4o',
      'fast': 'openai/gpt-4o-mini',
      'quality': 'openai/gpt-4o',
      'best': 'anthropic/claude-3-5-sonnet-20241022',
      'anthropic': 'anthropic/claude-3-5-haiku-20241022',
      'google': 'google/gemini-1.5-flash',
      'balanced': 'google/gemini-1.5-flash',
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get total chunks
      const { count: chunksCount } = await supabase
        .from("transcript_chunks")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      // Get last indexed date
      const { data: lastChunk } = await supabase
        .from("transcript_chunks")
        .select("created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Get total recordings
      const { count: totalRecordings } = await supabase
        .from("fathom_calls")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      // Get recordings that have been indexed (have chunks)
      const { data: indexedRecordingIds } = await supabase
        .from("transcript_chunks")
        .select("recording_id")
        .eq("user_id", user.id);

      const uniqueIndexedIds = new Set(
        indexedRecordingIds?.map((r) => r.recording_id) || []
      );

      setStats({
        totalChunks: chunksCount || 0,
        lastIndexedDate: lastChunk?.created_at || null,
        totalRecordings: totalRecordings || 0,
        unindexedRecordings: (totalRecordings || 0) - uniqueIndexedIds.size,
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
        setIndexing(true); // Resume polling for active job
      }

      // Load saved AI model preference
      const { data: settings } = await supabase
        .from("user_settings")
        .select("ai_model_preset")
        .eq("user_id", user.id)
        .maybeSingle();

      if (settings?.ai_model_preset) {
        // Map legacy preset values to new format
        const mappedPreset = mapLegacyPreset(settings.ai_model_preset);
        setSelectedModel(mappedPreset);
        setSavedModel(mappedPreset);
      }
    } catch (error) {
      logger.error("Error loading indexing stats", error);
      toast.error("Failed to load indexing statistics");
    } finally {
      setLoading(false);
    }
  }, []);

  // Save AI model preference
  const handleModelChange = async (newModel: string) => {
    setSelectedModel(newModel);
    setModelSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Not authenticated");
        setSelectedModel(savedModel);
        return;
      }

      // Upsert the model preference
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
        const preset = AI_MODEL_PRESETS.find(p => p.value === newModel);
        toast.success(`AI model updated to ${preset?.label || newModel}`);
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

        // Start polling for job status
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

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
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

  // Get the currently selected model details
  const currentModel = AI_MODEL_PRESETS.find(p => p.value === selectedModel);

  return (
    <div>
      {/* Top separator for breathing room */}
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
            className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-20 bg-vibe-green"
            style={{
              clipPath: "polygon(0px 0px, 100% 10%, 100% 90%, 0px 100%)",
            }}
          />

          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 mt-1">
              <RiRobot2Line className="h-6 w-6 text-cb-ink-muted" />
            </div>

            <div className="flex-1 space-y-4">
              <div>
                <h3 className="font-medium text-gray-900 dark:text-gray-50">
                  Metadata Extraction Model
                </h3>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-500">
                  Select the AI model used to extract topics, sentiment, entities, and intent signals from your call transcripts.
                </p>
              </div>

              <div className="max-w-md">
                <Select
                  value={selectedModel}
                  onValueChange={handleModelChange}
                  disabled={modelSaving}
                >
                  <SelectTrigger className="w-full">
                    {modelSaving ? (
                      <div className="flex items-center gap-2">
                        <RiLoader2Line className="h-4 w-4 animate-spin" />
                        <span>Saving...</span>
                      </div>
                    ) : (
                      <SelectValue placeholder="Select AI model">
                        {currentModel && (
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{currentModel.label}</span>
                            <span className="text-muted-foreground">({currentModel.provider})</span>
                          </div>
                        )}
                      </SelectValue>
                    )}
                  </SelectTrigger>
                  <SelectContent className="max-h-[400px]">
                    {Object.entries(PRESET_GROUPS).map(([provider, presets]) => (
                      presets.length > 0 && (
                        <SelectGroup key={provider}>
                          <SelectLabel>{provider}</SelectLabel>
                          {presets.map((preset) => (
                            <SelectItem key={preset.value} value={preset.value}>
                              <div className="flex flex-col">
                                <span className="font-medium">{preset.label}</span>
                                <span className="text-xs text-muted-foreground">{preset.description}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      )
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {currentModel && (
                <div className="pt-3 border-t border-cb-border dark:border-cb-border-dark">
                  <p className="text-xs text-muted-foreground">
                    <strong>Current:</strong> {currentModel.label} ({currentModel.provider}) - {currentModel.description}
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

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="relative py-2 px-4 bg-card border border-cb-border dark:border-cb-border-dark rounded-lg">
            <div
              className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-14 bg-vibe-green"
              style={{
                clipPath: "polygon(0px 0px, 100% 10%, 100% 90%, 0px 100%)",
              }}
            />
            <div className="flex items-center gap-3 mb-2">
              <RiDatabaseLine className="h-5 w-5 text-cb-ink-muted" />
              <p className="text-xs font-medium text-muted-foreground">Total Chunks</p>
            </div>
            <p className="text-2xl font-extrabold tabular-nums">{stats.totalChunks}</p>
          </div>

          <div className="relative py-2 px-4 bg-card border border-cb-border dark:border-cb-border-dark rounded-lg">
            <div
              className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-14 bg-vibe-green"
              style={{
                clipPath: "polygon(0px 0px, 100% 10%, 100% 90%, 0px 100%)",
              }}
            />
            <div className="flex items-center gap-3 mb-2">
              <RiCheckboxCircleLine className="h-5 w-5 text-cb-ink-muted" />
              <p className="text-xs font-medium text-muted-foreground">Indexed Calls</p>
            </div>
            <p className="text-2xl font-extrabold tabular-nums">
              {stats.totalRecordings - stats.unindexedRecordings}
            </p>
          </div>

          <div className="relative py-2 px-4 bg-card border border-cb-border dark:border-cb-border-dark rounded-lg">
            <div
              className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-14 bg-vibe-green"
              style={{
                clipPath: "polygon(0px 0px, 100% 10%, 100% 90%, 0px 100%)",
              }}
            />
            <div className="flex items-center gap-3 mb-2">
              <RiSparklingLine className="h-5 w-5 text-cb-ink-muted" />
              <p className="text-xs font-medium text-muted-foreground">Unindexed</p>
            </div>
            <p className="text-2xl font-extrabold tabular-nums">{stats.unindexedRecordings}</p>
          </div>

          <div className="relative py-2 px-4 bg-card border border-cb-border dark:border-cb-border-dark rounded-lg">
            <div
              className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-14 bg-vibe-green"
              style={{
                clipPath: "polygon(0px 0px, 100% 10%, 100% 90%, 0px 100%)",
              }}
            />
            <div className="flex items-center gap-3 mb-2">
              <RiCheckboxCircleLine className="h-5 w-5 text-cb-ink-muted" />
              <p className="text-xs font-medium text-muted-foreground">Last Indexed</p>
            </div>
            <p className="text-xs font-medium tabular-nums">
              {formatDate(stats.lastIndexedDate)}
            </p>
          </div>
        </div>

        {/* Indexing Action Card */}
        <div className="relative py-6 px-6 bg-card border border-cb-border dark:border-cb-border-dark rounded-lg">
          <div
            className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-20 bg-vibe-green"
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
                  <p className="mt-2 text-sm font-medium text-vibe-green">
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
                      className="bg-vibe-green h-2 rounded-full transition-all duration-300"
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
    </div>
  );
}
