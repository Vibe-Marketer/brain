/**
 * Generate Hooks Step
 *
 * Step 3 of the Call Content Generator wizard.
 * Allows users to generate hooks from insights and select which ones to use.
 */

import { useState } from 'react';
import {
  RiSparklingLine,
  RiCheckLine,
  RiLoader4Line,
  RiRefreshLine,
} from '@remixicon/react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  useContentWizardStore,
  useHooksStatus,
  useGeneratedHooks,
  useSelectedHooks,
  useGeneratedInsights,
  useSelectedProfile,
} from '@/stores/contentWizardStore';
import type { Hook, EmotionCategory } from '@/types/content-hub';

const EMOTION_COLORS: Record<EmotionCategory, string> = {
  anger_outrage: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  awe_surprise: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  social_currency: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  relatable: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  practical_value: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  humor_sharp: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
  neutral: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
};

const EMOTION_LABELS: Record<EmotionCategory, string> = {
  anger_outrage: 'Outrage',
  awe_surprise: 'Awe',
  social_currency: 'Social',
  relatable: 'Relatable',
  practical_value: 'Practical',
  humor_sharp: 'Humor',
  neutral: 'Neutral',
};

export function GenerateHooksStep() {
  const hooksStatus = useHooksStatus();
  const generatedHooks = useGeneratedHooks();
  const selectedHookIds = useSelectedHooks();
  const generatedInsights = useGeneratedInsights();
  const selectedProfileId = useSelectedProfile();

  const setHooksStatus = useContentWizardStore((state) => state.setHooksStatus);
  const setGeneratedHooks = useContentWizardStore((state) => state.setGeneratedHooks);
  const toggleHookSelection = useContentWizardStore((state) => state.toggleHookSelection);
  const selectAllHooks = useContentWizardStore((state) => state.selectAllHooks);
  const deselectAllHooks = useContentWizardStore((state) => state.deselectAllHooks);

  const [isGenerating, setIsGenerating] = useState(false);

  const generateHooks = async () => {
    setIsGenerating(true);
    setHooksStatus('running');

    try {
      // Simulate API call - in production, this calls the edge function
      await new Promise((resolve) => setTimeout(resolve, 2500));

      const mockHooks: Hook[] = [
        {
          id: 'hook-1',
          user_id: 'user-1',
          recording_id: null,
          hook_text: "Stop wasting hours on spreadsheets. Here's what happened when one team made the switch...",
          insight_ids: ['insight-1'],
          emotion_category: 'anger_outrage',
          virality_score: 5,
          topic_hint: 'productivity',
          is_starred: false,
          status: 'generated',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'hook-2',
          user_id: 'user-1',
          recording_id: null,
          hook_text: "One button. Everything synced. Zero errors. Is this the future of work?",
          insight_ids: ['insight-2'],
          emotion_category: 'awe_surprise',
          virality_score: 4,
          topic_hint: 'automation',
          is_starred: false,
          status: 'generated',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'hook-3',
          user_id: 'user-1',
          recording_id: null,
          hook_text: "\"But what if the system makes mistakes?\" Here's what we told our client...",
          insight_ids: ['insight-3'],
          emotion_category: 'relatable',
          virality_score: 4,
          topic_hint: 'trust',
          is_starred: false,
          status: 'generated',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'hook-4',
          user_id: 'user-1',
          recording_id: null,
          hook_text: "The 3 biggest lies about automation (and why they're costing you money)",
          insight_ids: ['insight-1', 'insight-3'],
          emotion_category: 'practical_value',
          virality_score: 5,
          topic_hint: 'myths',
          is_starred: false,
          status: 'generated',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'hook-5',
          user_id: 'user-1',
          recording_id: null,
          hook_text: "My client said: \"I can't believe we did this manually for 5 years.\"",
          insight_ids: ['insight-1', 'insight-2'],
          emotion_category: 'social_currency',
          virality_score: 4,
          topic_hint: 'transformation',
          is_starred: false,
          status: 'generated',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      setGeneratedHooks(mockHooks);
      setHooksStatus('completed');
    } catch (err) {
      setHooksStatus('error');
    } finally {
      setIsGenerating(false);
    }
  };

  const allSelected = generatedHooks.length > 0 && selectedHookIds.length === generatedHooks.length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Generate Hooks</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Create viral hooks from your call insights, then select which ones to use.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {generatedHooks.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={generateHooks}
              disabled={isGenerating}
            >
              <RiRefreshLine className={cn('w-4 h-4 mr-1', isGenerating && 'animate-spin')} />
              Generate More
            </Button>
          )}
        </div>
      </div>

      {/* No Hooks Yet */}
      {generatedHooks.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="p-4 bg-orange-100 dark:bg-orange-900/20 rounded-full mb-4">
            <RiSparklingLine className="w-8 h-8 text-cb-vibe-orange" />
          </div>
          <h4 className="font-medium">Ready to Generate Hooks</h4>
          <p className="text-sm text-muted-foreground mt-1 max-w-md">
            Based on {generatedInsights.length} insights from your calls, our AI will create
            viral hooks for your content.
          </p>
          <Button
            onClick={generateHooks}
            disabled={isGenerating}
            className="mt-4"
          >
            {isGenerating ? (
              <>
                <RiLoader4Line className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <RiSparklingLine className="w-4 h-4 mr-2" />
                Generate Hooks
              </>
            )}
          </Button>
        </div>
      )}

      {/* Hooks List */}
      {generatedHooks.length > 0 && (
        <>
          {/* Selection Controls */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {selectedHookIds.length} of {generatedHooks.length} hooks selected
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={allSelected ? deselectAllHooks : selectAllHooks}
            >
              {allSelected ? 'Deselect All' : 'Select All'}
            </Button>
          </div>

          {/* Hooks Grid */}
          <div className="grid gap-3">
            {generatedHooks.map((hook) => {
              const isSelected = selectedHookIds.includes(hook.id);
              return (
                <button
                  key={hook.id}
                  type="button"
                  onClick={() => toggleHookSelection(hook.id)}
                  className={cn(
                    'w-full text-left p-4 rounded-lg border transition-colors',
                    isSelected
                      ? 'border-cb-vibe-orange bg-orange-50 dark:bg-orange-950/20'
                      : 'border-border hover:border-cb-vibe-orange/50'
                  )}
                >
                  <div className="flex items-start gap-3">
                    {/* Checkbox */}
                    <div
                      className={cn(
                        'flex items-center justify-center w-5 h-5 rounded border-2 mt-0.5 flex-shrink-0 transition-colors',
                        isSelected
                          ? 'bg-cb-vibe-orange border-cb-vibe-orange'
                          : 'border-muted-foreground'
                      )}
                    >
                      {isSelected && <RiCheckLine className="w-3 h-3 text-white" />}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium leading-snug">{hook.hook_text}</p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {hook.emotion_category && (
                          <Badge
                            variant="secondary"
                            className={cn('text-xs', EMOTION_COLORS[hook.emotion_category])}
                          >
                            {EMOTION_LABELS[hook.emotion_category]}
                          </Badge>
                        )}
                        {hook.virality_score && (
                          <Badge variant="outline" className="text-xs">
                            Virality: {hook.virality_score}/5
                          </Badge>
                        )}
                        {hook.topic_hint && (
                          <span className="text-xs text-muted-foreground">
                            #{hook.topic_hint}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Validation */}
          {selectedHookIds.length === 0 && (
            <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-4">
              Select at least one hook to continue to content generation.
            </div>
          )}
        </>
      )}
    </div>
  );
}
