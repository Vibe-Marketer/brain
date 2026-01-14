/**
 * Extract & Analyze Step
 *
 * Step 2 of the Social Post Generator wizard.
 * Automatically runs Agent 1 (Classifier) and Agent 2 (Insight Miner).
 * Shows progress indicators for each agent.
 */

import { useEffect } from 'react';
import {
  RiCheckLine,
  RiLoader4Line,
  RiErrorWarningLine,
  RiSparklingLine,
  RiLightbulbLine,
} from '@remixicon/react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  useContentWizardStore,
  useClassificationStatus,
  useInsightsStatus,
  useClassificationResult,
  useGeneratedInsights,
  useSelectedCalls,
  useWizardError,
} from '@/stores/contentWizardStore';
import type { AgentStatus } from '@/types/content-hub';

interface AgentProgressProps {
  title: string;
  description: string;
  status: AgentStatus;
  icon: React.ReactNode;
  resultSummary?: string;
}

function AgentProgress({ title, description, status, icon, resultSummary }: AgentProgressProps) {
  return (
    <div
      className={cn(
        'flex items-start gap-4 p-4 rounded-lg border transition-colors',
        status === 'running' && 'border-vibe-orange bg-orange-50/50 dark:bg-orange-950/10',
        status === 'completed' && 'border-green-500 bg-green-50/50 dark:bg-green-950/10',
        status === 'error' && 'border-destructive bg-destructive/10',
        status === 'idle' && 'border-muted'
      )}
    >
      {/* Status Icon */}
      <div
        className={cn(
          'flex items-center justify-center w-10 h-10 rounded-full',
          status === 'idle' && 'bg-muted text-muted-foreground',
          status === 'running' && 'bg-vibe-orange/20 text-vibe-orange',
          status === 'completed' && 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
          status === 'error' && 'bg-destructive/20 text-destructive'
        )}
      >
        {status === 'running' ? (
          <RiLoader4Line className="w-5 h-5 animate-spin" />
        ) : status === 'completed' ? (
          <RiCheckLine className="w-5 h-5" />
        ) : status === 'error' ? (
          <RiErrorWarningLine className="w-5 h-5" />
        ) : (
          icon
        )}
      </div>

      {/* Content */}
      <div className="flex-1">
        <h4 className="font-medium">{title}</h4>
        <p className="text-sm text-muted-foreground">{description}</p>
        {status === 'completed' && resultSummary && (
          <p className="text-sm text-green-700 dark:text-green-400 mt-1">
            {resultSummary}
          </p>
        )}
      </div>
    </div>
  );
}

export function ExtractAnalyzeStep() {
  const selectedCalls = useSelectedCalls();
  const classificationStatus = useClassificationStatus();
  const insightsStatus = useInsightsStatus();
  const classificationResult = useClassificationResult();
  const generatedInsights = useGeneratedInsights();
  const error = useWizardError();

  const setClassificationStatus = useContentWizardStore((state) => state.setClassificationStatus);
  const setInsightsStatus = useContentWizardStore((state) => state.setInsightsStatus);
  const setClassificationResult = useContentWizardStore((state) => state.setClassificationResult);
  const setGeneratedInsights = useContentWizardStore((state) => state.setGeneratedInsights);
  const setError = useContentWizardStore((state) => state.setError);

  // Auto-start analysis when step loads
  useEffect(() => {
    if (classificationStatus === 'idle' && selectedCalls.length > 0) {
      runAnalysis();
    }
  }, [classificationStatus, selectedCalls]);

  const runAnalysis = async () => {
    try {
      setError(null);

      // Agent 1: Classification
      setClassificationStatus('running');

      // Simulate API call - in production, this calls the edge function
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const mockClassification = {
        call_type: 'sales' as const,
        stage: 'middle' as const,
        outcome: 'maybe' as const,
        emotional_intensity: 4,
        content_potential: 5,
        mine_for_content: true,
        notes: 'Great call with strong emotional moments and quotable insights.',
      };

      setClassificationResult(mockClassification);
      setClassificationStatus('completed');

      // Only run Agent 2 if mine_for_content is true
      if (mockClassification.mine_for_content) {
        setInsightsStatus('running');

        // Simulate API call
        await new Promise((resolve) => setTimeout(resolve, 3000));

        const mockInsights = [
          {
            id: 'insight-1',
            user_id: 'user-1',
            recording_id: selectedCalls[0],
            category: 'pain' as const,
            exact_quote: "We're spending hours every week manually updating spreadsheets and it's killing our productivity.",
            speaker: 'Customer',
            timestamp: '05:23',
            why_it_matters: 'Strong pain point that resonates with similar audiences',
            score: 5,
            emotion_category: 'anger_outrage' as const,
            virality_score: 4,
            topic_hint: 'manual processes',
            created_at: new Date().toISOString(),
          },
          {
            id: 'insight-2',
            user_id: 'user-1',
            recording_id: selectedCalls[0],
            category: 'dream_outcome' as const,
            exact_quote: "Imagine if we could just click one button and have everything synced automatically.",
            speaker: 'Customer',
            timestamp: '12:45',
            why_it_matters: 'Clear vision of desired outcome',
            score: 4,
            emotion_category: 'awe_surprise' as const,
            virality_score: 3,
            topic_hint: 'automation',
            created_at: new Date().toISOString(),
          },
          {
            id: 'insight-3',
            user_id: 'user-1',
            recording_id: selectedCalls[0],
            category: 'objection_or_fear' as const,
            exact_quote: "But what if the system makes mistakes? We can't afford errors with client data.",
            speaker: 'Customer',
            timestamp: '18:30',
            why_it_matters: 'Common objection that needs addressing',
            score: 4,
            emotion_category: 'relatable' as const,
            virality_score: 3,
            topic_hint: 'data accuracy',
            created_at: new Date().toISOString(),
          },
        ];

        setGeneratedInsights(mockInsights);
        setInsightsStatus('completed');
      } else {
        setInsightsStatus('completed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
      if (classificationStatus === 'running') {
        setClassificationStatus('error');
      }
      if (insightsStatus === 'running') {
        setInsightsStatus('error');
      }
    }
  };

  const hasError = classificationStatus === 'error' || insightsStatus === 'error';
  const isComplete = classificationStatus === 'completed' && insightsStatus === 'completed';

  return (
    <div className="p-6 space-y-6">
      <div>
        <h3 className="text-lg font-medium">Analyzing Your Calls</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Our AI is extracting insights from {selectedCalls.length} call{selectedCalls.length !== 1 ? 's' : ''}.
          This may take a moment.
        </p>
      </div>

      {/* Agent Progress Cards */}
      <div className="space-y-4">
        <AgentProgress
          title="Call Classification"
          description="Analyzing call type, stage, and content potential"
          status={classificationStatus}
          icon={<RiSparklingLine className="w-5 h-5" />}
          resultSummary={
            classificationResult
              ? `${classificationResult.call_type} call · Content potential: ${classificationResult.content_potential}/5`
              : undefined
          }
        />

        <AgentProgress
          title="Insight Mining"
          description="Extracting pains, dreams, objections, and quotable moments"
          status={insightsStatus}
          icon={<RiLightbulbLine className="w-5 h-5" />}
          resultSummary={
            generatedInsights.length > 0
              ? `Found ${generatedInsights.length} high-quality insight${generatedInsights.length !== 1 ? 's' : ''}`
              : undefined
          }
        />
      </div>

      {/* Error State */}
      {hasError && error && (
        <div className="bg-destructive/10 border border-destructive rounded-lg p-4">
          <div className="flex items-start gap-3">
            <RiErrorWarningLine className="w-5 h-5 text-destructive mt-0.5" />
            <div>
              <p className="font-medium text-destructive">Analysis Failed</p>
              <p className="text-sm text-destructive/80 mt-1">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={runAnalysis}
                className="mt-3"
              >
                Retry
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Success State */}
      {isComplete && (
        <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
            <RiCheckLine className="w-5 h-5" />
            <span className="font-medium">Analysis complete! Continue to generate hooks.</span>
          </div>
        </div>
      )}
    </div>
  );
}
