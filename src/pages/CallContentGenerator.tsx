/**
 * Social Post Generator Page
 *
 * Wrapper page for the 4-step wizard.
 * Manages wizard lifecycle and navigation.
 *
 * Uses the 3-pane architecture:
 * - Pane 1: Navigation rail (via AppShell)
 * - Pane 2: ContentCategoryPane for content navigation
 * - Pane 3: Main content (wizard)
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { RiArrowLeftLine, RiSparklingLine } from '@remixicon/react';
import { Button } from '@/components/ui/button';
import { useContentWizardStore } from '@/stores/contentWizardStore';
import { CallContentWizard } from '@/components/content-hub/CallContentWizard';
import { AppShell } from '@/components/layout/AppShell';
import { ContentCategoryPane } from '@/components/panes/ContentCategoryPane';

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
    <AppShell
      config={{
        secondaryPane: <ContentCategoryPane />,
      }}
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-8 h-8 rounded-lg bg-vibe-orange/10 flex items-center justify-center flex-shrink-0"
              aria-hidden="true"
            >
              <RiSparklingLine className="h-4 w-4 text-vibe-orange" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-ink uppercase tracking-wide">
                SOCIAL POST GENERATOR
              </h2>
              <p className="text-xs text-ink-muted">
                Transform call transcripts into viral content
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCancel}
            className="gap-2"
          >
            <RiArrowLeftLine className="w-4 h-4" />
            Back
          </Button>
        </header>

        {/* Wizard */}
        <div className="flex-1 overflow-hidden">
          <CallContentWizard
            onComplete={handleComplete}
            onCancel={handleCancel}
          />
        </div>
      </div>
    </AppShell>
  );
}
