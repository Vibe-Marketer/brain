/**
 * Call Content Wizard
 *
 * 4-step wizard for generating content from call transcripts.
 * Steps:
 * 1. Select Sources - Choose calls and business profile
 * 2. Extract & Analyze - Run Agent 1 (Classifier) and Agent 2 (Insight Miner)
 * 3. Generate Hooks - Run Agent 3 (Hook Generator), select hooks
 * 4. Create Content - Run Agent 4 (Content Builder) with streaming
 */

import { useCallback, useState } from 'react';
import { RiCheckLine, RiLoader4Line } from '@remixicon/react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useBankContext } from '@/hooks/useBankContext';
import { useToast } from '@/hooks/use-toast';
import {
  useContentWizardStore,
  useCurrentStep,
  useIsProcessing,
  useCanProceed,
} from '@/stores/contentWizardStore';
import type { WizardStep } from '@/types/content-hub';

// Import step components
import { SelectSourcesStep } from './wizard/SelectSourcesStep';
import { ExtractAnalyzeStep } from './wizard/ExtractAnalyzeStep';
import { GenerateHooksStep } from './wizard/GenerateHooksStep';
import { CreateContentStep } from './wizard/CreateContentStep';

interface CallContentWizardProps {
  onComplete?: () => void;
  onCancel?: () => void;
}

interface StepConfig {
  id: WizardStep;
  label: string;
  shortLabel: string;
}

const STEPS: StepConfig[] = [
  { id: 'select-sources', label: 'Select Sources', shortLabel: '1. Sources' },
  { id: 'extract-analyze', label: 'Extract & Analyze', shortLabel: '2. Analyze' },
  { id: 'generate-hooks', label: 'Generate Hooks', shortLabel: '3. Hooks' },
  { id: 'create-content', label: 'Create Content', shortLabel: '4. Content' },
];

const STEP_ORDER: WizardStep[] = ['select-sources', 'extract-analyze', 'generate-hooks', 'create-content'];

export function CallContentWizard({ onComplete, onCancel }: CallContentWizardProps) {
  const { toast } = useToast();
  const currentStep = useCurrentStep();
  const isProcessing = useIsProcessing();
  const canProceed = useCanProceed();
  const [isSaving, setIsSaving] = useState(false);

  const nextStep = useContentWizardStore((state) => state.nextStep);
  const prevStep = useContentWizardStore((state) => state.prevStep);
  const goToStep = useContentWizardStore((state) => state.goToStep);
  const saveAllContent = useContentWizardStore((state) => state.saveAllContent);
  const { activeBankId } = useBankContext();

  const currentIndex = STEP_ORDER.indexOf(currentStep);
  const isFirstStep = currentIndex === 0;
  const isLastStep = currentIndex === STEP_ORDER.length - 1;

  const handleNext = useCallback(async () => {
    if (isLastStep) {
      // Save content before completing wizard
      setIsSaving(true);
      try {
        const saveResult = await saveAllContent(activeBankId);

        if (saveResult.success) {
          toast({
            title: 'Content Saved!',
            description: `Saved ${saveResult.savedHookIds.length} hook${saveResult.savedHookIds.length !== 1 ? 's' : ''} and ${saveResult.savedContentIds.length} content item${saveResult.savedContentIds.length !== 1 ? 's' : ''} to your library.`,
          });

          // Partial success warning if there were some errors
          if (saveResult.errors.length > 0) {
            toast({
              title: 'Some items had issues',
              description: saveResult.errors.join(', '),
              variant: 'destructive',
            });
          }
        } else {
          toast({
            title: 'Save Failed',
            description: saveResult.errors.join(', ') || 'Unable to save content. Please try again.',
            variant: 'destructive',
          });
        }
      } catch (error) {
        toast({
          title: 'Save Error',
          description: error instanceof Error ? error.message : 'An unexpected error occurred.',
          variant: 'destructive',
        });
      } finally {
        setIsSaving(false);
      }

      // Call onComplete callback after save attempt
      onComplete?.();
    } else {
      nextStep();
    }
  }, [isLastStep, onComplete, nextStep, saveAllContent, activeBankId, toast]);

  const handleBack = useCallback(() => {
    prevStep();
  }, [prevStep]);

  const getStepStatus = (stepIndex: number): 'completed' | 'current' | 'upcoming' => {
    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'current';
    return 'upcoming';
  };

  return (
    <div className="flex flex-col h-full">
      {/* Step Indicator */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-muted/30">
        {STEPS.map((step, index) => {
          const status = getStepStatus(index);
          return (
            <div key={step.id} className="flex items-center flex-1">
              {/* Step Circle */}
              <button
                type="button"
                onClick={() => status === 'completed' && goToStep(step.id)}
                disabled={status === 'upcoming' || isProcessing}
                className={cn(
                  'flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors',
                  status === 'completed' && 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 cursor-pointer hover:bg-green-200',
                  status === 'current' && 'bg-vibe-orange text-white',
                  status === 'upcoming' && 'bg-muted text-muted-foreground'
                )}
              >
                {status === 'completed' ? (
                  <RiCheckLine className="w-4 h-4" />
                ) : (
                  index + 1
                )}
              </button>

              {/* Step Label */}
              <span
                className={cn(
                  'ml-2 text-sm font-medium hidden sm:block',
                  status === 'current' && 'text-foreground',
                  status !== 'current' && 'text-muted-foreground'
                )}
              >
                {step.label}
              </span>

              {/* Connector Line */}
              {index < STEPS.length - 1 && (
                <div
                  className={cn(
                    'flex-1 h-0.5 mx-4',
                    status === 'completed' ? 'bg-green-500' : 'bg-muted'
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Step Content */}
      <div className="flex-1 overflow-auto">
        {currentStep === 'select-sources' && <SelectSourcesStep />}
        {currentStep === 'extract-analyze' && <ExtractAnalyzeStep />}
        {currentStep === 'generate-hooks' && <GenerateHooksStep />}
        {currentStep === 'create-content' && <CreateContentStep />}
      </div>

      {/* Navigation Footer */}
      <div className="flex items-center justify-between px-6 py-4 border-t bg-background">
        <div className="flex items-center gap-2">
          {onCancel && (
            <Button
              variant="ghost"
              onClick={onCancel}
              disabled={isProcessing}
            >
              Cancel
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!isFirstStep && (
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={isProcessing}
            >
              Back
            </Button>
          )}

          <Button
            onClick={handleNext}
            disabled={!canProceed || isProcessing || isSaving}
          >
            {(isProcessing || isSaving) && <RiLoader4Line className="w-4 h-4 mr-2 animate-spin" />}
            {isSaving ? 'Saving...' : isLastStep ? 'Done' : 'Continue'}
          </Button>
        </div>
      </div>
    </div>
  );
}
