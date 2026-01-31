/**
 * ImportProgress - Step progress indicator for YouTube import
 *
 * Displays a 4-step progress indicator:
 * 1. Fetching Metadata (active when validating/checking/fetching)
 * 2. Transcribing (active when transcribing)
 * 3. Processing (active when processing)
 * 4. Done (active when done)
 *
 * Uses Remix icons for step states:
 * - Completed: RiCheckLine with green
 * - Active: RiLoader4Line with spin animation
 * - Pending: RiCircleLine with muted color
 * - Error: RiErrorWarningLine with red
 *
 * @pattern import-progress
 * @brand-version v4.2
 */

import * as React from 'react';
import {
  RiCheckLine,
  RiLoader4Line,
  RiCircleLine,
  RiErrorWarningLine,
  RiDownload2Line,
  RiFileTextLine,
  RiCpuLine,
  RiCheckDoubleLine,
} from '@remixicon/react';
import { cn } from '@/lib/utils';

export type ImportStep = 'idle' | 'validating' | 'checking' | 'fetching' | 'transcribing' | 'processing' | 'done' | 'error';

interface ImportProgressProps {
  /** Current step in the import process */
  currentStep: ImportStep;
  /** Error message to display when currentStep === 'error' */
  error?: string;
  /** Additional CSS classes */
  className?: string;
}

interface StepConfig {
  id: string;
  label: string;
  icon: React.ElementType;
  /** Steps that make this step active */
  activeWhen: ImportStep[];
  /** Steps that make this step complete */
  completeWhen: ImportStep[];
}

const steps: StepConfig[] = [
  {
    id: 'fetch',
    label: 'Fetching Metadata',
    icon: RiDownload2Line,
    activeWhen: ['validating', 'checking', 'fetching'],
    completeWhen: ['transcribing', 'processing', 'done'],
  },
  {
    id: 'transcribe',
    label: 'Transcribing',
    icon: RiFileTextLine,
    activeWhen: ['transcribing'],
    completeWhen: ['processing', 'done'],
  },
  {
    id: 'process',
    label: 'Processing',
    icon: RiCpuLine,
    activeWhen: ['processing'],
    completeWhen: ['done'],
  },
  {
    id: 'done',
    label: 'Done',
    icon: RiCheckDoubleLine,
    activeWhen: ['done'],
    completeWhen: [],
  },
];

type StepState = 'pending' | 'active' | 'complete' | 'error';

function getStepState(step: StepConfig, currentStep: ImportStep): StepState {
  if (currentStep === 'error') {
    // Mark all incomplete steps as error, completed steps stay complete
    if (step.completeWhen.length > 0) {
      const isComplete = step.completeWhen.includes(currentStep) || 
        step.completeWhen.some(s => steps.findIndex(st => st.activeWhen.includes(s)) < steps.findIndex(st => st.id === step.id));
      if (isComplete) return 'complete';
    }
    if (step.activeWhen.some(s => ['validating', 'checking', 'fetching', 'transcribing', 'processing'].includes(s))) {
      // Find if we passed this step before error
      const stepIndex = steps.findIndex(s => s.id === step.id);
      const errorHappenedBefore = stepIndex > 0;
      // For simplicity, mark active step as error
      return 'error';
    }
    return 'pending';
  }
  
  if (step.activeWhen.includes(currentStep)) return 'active';
  if (step.completeWhen.includes(currentStep)) return 'complete';
  
  // Check if this step's completion point has been passed
  const stepIndex = steps.findIndex(s => s.id === step.id);
  const currentStepIndex = steps.findIndex(s => s.activeWhen.includes(currentStep) || s.completeWhen.includes(currentStep));
  if (currentStepIndex > stepIndex) return 'complete';
  
  return 'pending';
}

function StepIcon({ state, Icon }: { state: StepState; Icon: React.ElementType }) {
  switch (state) {
    case 'complete':
      return <RiCheckLine className="w-5 h-5 text-green-500" />;
    case 'active':
      return <RiLoader4Line className="w-5 h-5 text-vibe-orange animate-spin" />;
    case 'error':
      return <RiErrorWarningLine className="w-5 h-5 text-destructive" />;
    case 'pending':
    default:
      return <RiCircleLine className="w-5 h-5 text-muted-foreground" />;
  }
}

export function ImportProgress({ currentStep, error, className }: ImportProgressProps) {
  if (currentStep === 'idle') {
    return null;
  }

  return (
    <div className={cn("space-y-3", className)}>
      {/* Progress steps */}
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const state = getStepState(step, currentStep);
          const isLast = index === steps.length - 1;
          
          return (
            <React.Fragment key={step.id}>
              {/* Step indicator */}
              <div className="flex flex-col items-center gap-1.5 min-w-0">
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors duration-300",
                    state === 'complete' && "border-green-500 bg-green-500/10",
                    state === 'active' && "border-vibe-orange bg-vibe-orange/10",
                    state === 'error' && "border-destructive bg-destructive/10",
                    state === 'pending' && "border-muted bg-muted/50"
                  )}
                >
                  <StepIcon state={state} Icon={step.icon} />
                </div>
                <span
                  className={cn(
                    "text-xs font-medium text-center truncate max-w-[80px]",
                    state === 'complete' && "text-green-600 dark:text-green-400",
                    state === 'active' && "text-vibe-orange",
                    state === 'error' && "text-destructive",
                    state === 'pending' && "text-muted-foreground"
                  )}
                >
                  {step.label}
                </span>
              </div>
              
              {/* Connector line */}
              {!isLast && (
                <div className="flex-1 h-0.5 mx-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      "h-full transition-all duration-500",
                      (state === 'complete' || getStepState(steps[index + 1], currentStep) !== 'pending')
                        ? "w-full bg-green-500"
                        : "w-0"
                    )}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
      
      {/* Error message */}
      {currentStep === 'error' && error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
          <RiErrorWarningLine className="w-4 h-4 text-destructive flex-shrink-0" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}
    </div>
  );
}
