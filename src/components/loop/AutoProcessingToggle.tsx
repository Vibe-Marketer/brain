/**
 * AutoProcessingToggle Component
 * 
 * Toggle for enabling automatic AI processing of new calls
 * Shows status and allows users to configure auto-processing
 */

import React, { useState } from 'react';
import {
  RiRobot2Line,
  RiSettings4Line,
  RiCheckLine
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
import { toast } from 'sonner';

interface AutoProcessingConfig {
  enabled: boolean;
  extractInsights: boolean;
  generateSummary: boolean;
  detectSentiment: boolean;
  identifyActionItems: boolean;
  applyPROFITS: boolean;
}

export const AutoProcessingToggle: React.FC = () => {
  const [config, setConfig] = useState<AutoProcessingConfig>({
    enabled: true,
    extractInsights: true,
    generateSummary: true,
    detectSentiment: true,
    identifyActionItems: true,
    applyPROFITS: true,
  });

  const handleToggle = (key: keyof AutoProcessingConfig) => {
    setConfig(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSave = () => {
    // TODO: Save to user preferences in Supabase
    toast.success('Auto-processing settings saved!');
  };

  const processingSteps = [
    {
      key: 'extractInsights' as const,
      label: 'Extract Insights',
      description: 'Identify pain points, objections, and success stories',
    },
    {
      key: 'generateSummary' as const,
      label: 'Generate Summary',
      description: 'Create concise call summaries',
    },
    {
      key: 'detectSentiment' as const,
      label: 'Detect Sentiment',
      description: 'Analyze conversation tone and sentiment',
    },
    {
      key: 'identifyActionItems' as const,
      label: 'Identify Action Items',
      description: 'Extract follow-up tasks and commitments',
    },
    {
      key: 'applyPROFITS' as const,
      label: 'Apply PROFITS Framework',
      description: 'Categorize insights using PROFITS methodology',
    },
  ];

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-2 rounded-lg",
            config.enabled 
              ? "bg-purple-100 dark:bg-purple-900/20" 
              : "bg-gray-100 dark:bg-gray-800"
          )}>
            <RiRobot2Line className={cn(
              "w-5 h-5",
              config.enabled 
                ? "text-purple-600 dark:text-purple-400" 
                : "text-gray-600 dark:text-gray-400"
            )} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Auto AI Processing
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {config.enabled ? 'Automatically process new calls' : 'Manual processing only'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm">
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
                        checked={config[step.key]}
                        onCheckedChange={() => handleToggle(step.key)}
                        disabled={!config.enabled}
                      />
                      <div className="flex-1">
                        <Label
                          htmlFor={step.key}
                          className={cn(
                            "text-sm font-medium cursor-pointer",
                            !config.enabled && "opacity-50"
                          )}
                        >
                          {step.label}
                        </Label>
                        <p className={cn(
                          "text-xs text-gray-500 dark:text-gray-400",
                          !config.enabled && "opacity-50"
                        )}>
                          {step.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <Separator />

                <Button
                  onClick={handleSave}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                  size="sm"
                >
                  Save Settings
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          <Switch
            checked={config.enabled}
            onCheckedChange={() => handleToggle('enabled')}
          />
        </div>
      </div>

      {/* Status Indicator */}
      {config.enabled && (
        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
            <RiCheckLine className="w-3 h-3" />
            <span>Active</span>
          </div>
          <span className="text-gray-400">•</span>
          <span className="text-gray-500 dark:text-gray-400">
            {processingSteps.filter(s => config[s.key]).length} of {processingSteps.length} steps enabled
          </span>
        </div>
      )}
    </div>
  );
};
