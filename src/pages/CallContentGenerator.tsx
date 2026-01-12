/**
 * Call Content Generator Page
 *
 * Wrapper page for the 4-step wizard.
 * Manages wizard lifecycle and navigation.
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { RiArrowLeftLine } from '@remixicon/react';
import { Button } from '@/components/ui/button';
import { useContentWizardStore } from '@/stores/contentWizardStore';
import { CallContentWizard } from '@/components/content-hub/CallContentWizard';

export default function CallContentGenerator() {
  const navigate = useNavigate();
  const reset = useContentWizardStore((state) => state.reset);

  // Reset wizard state on mount
  useEffect(() => {
    reset();
  }, [reset]);

  const handleComplete = () => {
    navigate('/content');
  };

  const handleCancel = () => {
    reset();
    navigate('/content/generators');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-4 p-4 border-b">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCancel}
          className="gap-2"
        >
          <RiArrowLeftLine className="w-4 h-4" />
          Back
        </Button>
        <div>
          <h1 className="text-lg font-semibold">Call Content Generator</h1>
          <p className="text-sm text-muted-foreground">
            Transform call transcripts into viral content
          </p>
        </div>
      </div>

      {/* Wizard */}
      <div className="flex-1 overflow-hidden">
        <CallContentWizard
          onComplete={handleComplete}
          onCancel={handleCancel}
        />
      </div>
    </div>
  );
}
