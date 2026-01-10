/**
 * AutoProcessingToggle Component
 *
 * Toggle for enabling automatic AI processing of new calls
 * Shows status and allows users to configure auto-processing
 *
 * Uses preferencesStore for persistence to database
 */

import React, { useEffect } from 'react';
import {
  RiRobot2Line,
  RiSettings4Line,
  RiCheckLine,
  RiLoader4Line
} from '@remixicon/react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { usePreferencesStore, type AutoProcessingPreferences } from '@/stores/preferencesStore';

/**
 * Processing step configuration for the UI
 */
interface ProcessingStep {
  key: keyof AutoProcessingPreferences;
  label: string;
  description: string;
}

/**
 * Available auto-processing options
 */
const processingSteps: ProcessingStep[] = [
  {
    key: 'autoProcessingTitleGeneration',
    label: 'Auto Title Generation',
    description: 'Automatically generate titles for new calls using AI',
  },
  {
    key: 'autoProcessingTagging',
    label: 'Auto Tagging',
    description: 'Automatically apply relevant tags to new calls',
  },
];

export const AutoProcessingToggle: React.FC = () => {
  // Use preferences from the store
  const {
    preferences,
    isLoading,
    isInitialized,
    error,
    loadPreferences,
    updatePreference,
    resetError
  } = usePreferencesStore();

  // Load preferences on mount if not already initialized
  useEffect(() => {
    if (!isInitialized && !isLoading) {
      loadPreferences();
    }
  }, [isInitialized, isLoading, loadPreferences]);

  // Reset error when component unmounts
  useEffect(() => {
    return () => {
      if (error) {
        resetError();
      }
    };
  }, [error, resetError]);

  /**
   * Handle toggle change for a preference
   */
  const handleToggle = (key: keyof AutoProcessingPreferences) => {
    updatePreference(key, !preferences[key]);
  };

  /**
   * Check if any processing option is enabled
   */
  const hasAnyEnabled = processingSteps.some(step => preferences[step.key]);

  /**
   * Count of enabled processing steps
   */
  const enabledCount = processingSteps.filter(step => preferences[step.key]).length;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-2 rounded-lg",
            hasAnyEnabled
              ? "bg-purple-100 dark:bg-purple-900/20"
              : "bg-gray-100 dark:bg-gray-800"
          )}>
            {isLoading ? (
              <RiLoader4Line className="w-5 h-5 text-gray-600 dark:text-gray-400 animate-spin" />
            ) : (
              <RiRobot2Line className={cn(
                "w-5 h-5",
                hasAnyEnabled
                  ? "text-purple-600 dark:text-purple-400"
                  : "text-gray-600 dark:text-gray-400"
              )} />
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Auto AI Processing
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {isLoading
                ? 'Loading preferences...'
                : hasAnyEnabled
                  ? 'Automatically process new calls'
                  : 'Manual processing only'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" disabled={isLoading}>
                <RiSettings4Line className="w-4 h-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-sm mb-1">Processing Options</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Configure what happens when you upload a new call
                  </p>
                </div>

                <Separator />

                <div className="space-y-3">
                  {processingSteps.map((step) => (
                    <div key={step.key} className="flex items-start gap-3">
                      <Switch
                        id={step.key}
                        checked={preferences[step.key]}
                        onCheckedChange={() => handleToggle(step.key)}
                        disabled={isLoading}
                      />
                      <div className="flex-1">
                        <Label
                          htmlFor={step.key}
                          className={cn(
                            "text-sm font-medium cursor-pointer",
                            isLoading && "opacity-50"
                          )}
                        >
                          {step.label}
                        </Label>
                        <p className={cn(
                          "text-xs text-gray-500 dark:text-gray-400",
                          isLoading && "opacity-50"
                        )}>
                          {step.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {error && (
                  <>
                    <Separator />
                    <p className="text-xs text-red-500 dark:text-red-400">
                      {error}
                    </p>
                  </>
                )}

                <Separator />

                <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                  Changes are saved automatically
                </p>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Status Indicator */}
      {!isLoading && hasAnyEnabled && (
        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
            <RiCheckLine className="w-3 h-3" />
            <span>Active</span>
          </div>
          <span className="text-gray-400">•</span>
          <span className="text-gray-500 dark:text-gray-400">
            {enabledCount} of {processingSteps.length} options enabled
          </span>
        </div>
      )}

      {/* Loading Indicator */}
      {isLoading && (
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <RiLoader4Line className="w-3 h-3 animate-spin" />
          <span>Loading preferences...</span>
        </div>
      )}

      {/* Error Indicator (in collapsed state) */}
      {!isLoading && error && (
        <div className="flex items-center gap-2 text-xs text-red-500 dark:text-red-400">
          <span>Failed to save preferences</span>
        </div>
      )}
    </div>
  );
};
