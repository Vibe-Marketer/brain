/**
 * ManualImport - Dedicated page for manual content imports
 *
 * Currently supports YouTube video imports, with future expansion planned
 * for other content sources (podcasts, audio files, etc.).
 *
 * Uses AppShell layout per src/CLAUDE.md requirements.
 *
 * @pattern page-component
 * @brand-version v4.2
 */

import * as React from 'react';
import { useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  RiYoutubeLine, 
  RiArrowRightLine, 
  RiExternalLinkLine,
  RiCheckboxCircleLine,
} from '@remixicon/react';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { YouTubeImportForm } from '@/components/import/YouTubeImportForm';
import { cn } from '@/lib/utils';

interface ImportResult {
  recordingId: number;
  title: string;
}

export default function ManualImport() {
  const navigate = useNavigate();
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const handleSuccess = useCallback((recordingId: number, title: string) => {
    setImportResult({ recordingId, title });
    toast.success('Video imported successfully!', {
      description: title,
    });
  }, []);

  const handleError = useCallback((error: string) => {
    toast.error('Import failed', {
      description: error,
    });
  }, []);

  const handleReset = useCallback(() => {
    setImportResult(null);
  }, []);

  return (
    <AppShell>
      <div className="h-full flex flex-col overflow-hidden">
        {/* Header */}
        <header className="flex-shrink-0 px-6 py-5 border-b border-border">
          <h1 className="font-montserrat font-extrabold text-xl uppercase tracking-wide text-foreground">
            Import Content
          </h1>
          <p className="mt-1 text-sm text-muted-foreground font-inter font-light">
            Import videos from YouTube to analyze with AI and search across your library.
          </p>
        </header>

        {/* Main content area */}
        <div className="flex-1 overflow-auto">
          <div className="max-w-xl mx-auto px-6 py-8">
            {/* Success state */}
            {importResult ? (
              <div className="space-y-6">
                {/* Success message */}
                <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                      <RiCheckboxCircleLine className="w-5 h-5 text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="font-semibold text-foreground mb-1">
                        Import Successful!
                      </h2>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {importResult.title}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    asChild
                    className="flex-1"
                  >
                    <Link to={`/call/${importResult.recordingId}`}>
                      View Call
                      <RiArrowRightLine className="w-4 h-4 ml-2" />
                    </Link>
                  </Button>
                  <Button
                    variant="hollow"
                    onClick={handleReset}
                    className="flex-1"
                  >
                    Import Another
                  </Button>
                </div>

                {/* Quick link to chat */}
                <div className="text-center pt-4 border-t border-border">
                  <p className="text-sm text-muted-foreground mb-2">
                    Or ask AI about this video
                  </p>
                  <Button
                    variant="ghost"
                    asChild
                    className="text-vibe-orange hover:text-vibe-orange/80"
                  >
                    <Link to="/chat">
                      Open AI Chat
                      <RiExternalLinkLine className="w-3.5 h-3.5 ml-1.5" />
                    </Link>
                  </Button>
                </div>
              </div>
            ) : (
              /* Import form */
              <div className="space-y-6">
                {/* YouTube card */}
                <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                      <RiYoutubeLine className="w-5 h-5 text-red-600" />
                    </div>
                    <div>
                      <h2 className="font-semibold text-foreground">
                        YouTube Video
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        Import video transcripts from YouTube
                      </p>
                    </div>
                  </div>

                  <YouTubeImportForm
                    onSuccess={handleSuccess}
                    onError={handleError}
                  />
                </div>

                {/* Info note */}
                <div className="text-center text-xs text-muted-foreground">
                  <p>
                    YouTube imports work with public videos that have captions enabled.
                  </p>
                  <p className="mt-1">
                    The video's transcript will be imported and made searchable.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
