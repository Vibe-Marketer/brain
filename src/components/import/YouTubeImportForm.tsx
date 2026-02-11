/**
 * YouTubeImportForm - YouTube URL input form with progress tracking
 *
 * Allows users to paste a YouTube URL and import the video as a call transcript.
 * Shows step-by-step progress during the import process.
 *
 * Features:
 * - URL validation with format hints
 * - Auto-detect YouTube URLs on paste
 * - Progress tracking via ImportProgress component
 * - Success and error state handling
 *
 * @pattern youtube-import-form
 * @brand-version v4.2
 */

import * as React from 'react';
import { useState, useCallback } from 'react';
import { RiYoutubeLine, RiArrowRightLine, RiLink } from '@remixicon/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { ImportProgress, type ImportStep } from './ImportProgress';
import { VaultSelector } from '@/components/vault/VaultSelector';

interface YouTubeImportFormProps {
  /** Callback when import succeeds */
  onSuccess: (recordingId: number, title: string) => void;
  /** Callback when import fails */
  onError: (error: string) => void;
  /** Additional CSS classes */
  className?: string;
}

interface ImportResponse {
  success: boolean;
  step: ImportStep;
  error?: string;
  recordingId?: number;
  title?: string;
  exists?: boolean;
}

/**
 * Validate if a string looks like a YouTube URL or video ID
 */
function isValidYouTubeInput(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed) return false;
  
  // Direct video ID (11 characters, alphanumeric + _ -)
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return true;
  }
  
  // YouTube URL patterns
  const youtubePatterns = [
    /youtube\.com\/watch\?.*v=/,
    /youtu\.be\//,
    /youtube\.com\/embed\//,
    /youtube\.com\/v\//,
  ];
  
  return youtubePatterns.some(pattern => pattern.test(trimmed));
}

/**
 * Check if pasted text contains a YouTube URL
 */
function extractYouTubeUrl(text: string): string | null {
  const trimmed = text.trim();
  
  // Direct video ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }
  
  // URL patterns
  const urlMatch = trimmed.match(/(https?:\/\/)?(www\.)?(youtube\.com\/watch\?[^\s]+|youtu\.be\/[^\s]+|youtube\.com\/embed\/[^\s]+)/i);
  if (urlMatch) {
    return urlMatch[0].startsWith('http') ? urlMatch[0] : `https://${urlMatch[0]}`;
  }
  
  return null;
}

export function YouTubeImportForm({ onSuccess, onError, className }: YouTubeImportFormProps) {
  const [url, setUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [currentStep, setCurrentStep] = useState<ImportStep>('idle');
  const [error, setError] = useState<string | undefined>();
  const [selectedVaultId, setSelectedVaultId] = useState<string>('');

  const handlePaste = useCallback((event: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedText = event.clipboardData.getData('text');
    const youtubeUrl = extractYouTubeUrl(pastedText);
    if (youtubeUrl) {
      event.preventDefault();
      setUrl(youtubeUrl);
      setError(undefined);
      setCurrentStep('idle');
    }
  }, []);

  const handleSubmit = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    
    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      setError('Please enter a YouTube URL');
      return;
    }

    if (!isValidYouTubeInput(trimmedUrl)) {
      setError('Please enter a valid YouTube URL');
      return;
    }

    setIsImporting(true);
    setError(undefined);
    setCurrentStep('validating');

    // Simulate multi-step progress while waiting for the single-request edge function.
    // The edge function performs: validate → check duplicate → fetch metadata → transcribe → process → done.
    // We advance the UI through these steps on a timer so the user sees real progress.
    const progressSteps: { step: ImportStep; delay: number }[] = [
      { step: 'checking', delay: 800 },
      { step: 'fetching', delay: 1800 },
      { step: 'transcribing', delay: 4000 },
      { step: 'processing', delay: 8000 },
    ];

    let cancelled = false;
    const timeoutIds: ReturnType<typeof setTimeout>[] = [];

    for (const { step, delay } of progressSteps) {
      const id = setTimeout(() => {
        if (!cancelled) setCurrentStep(step);
      }, delay);
      timeoutIds.push(id);
    }

    try {
      const { data, error: invokeError } = await supabase.functions.invoke<ImportResponse>('youtube-import', {
        body: { videoUrl: trimmedUrl, vault_id: selectedVaultId || undefined },
      });

      // Stop simulated progress — real response arrived
      cancelled = true;
      timeoutIds.forEach(clearTimeout);

      if (invokeError) {
        throw new Error(invokeError.message || 'Failed to import video');
      }

      if (!data) {
        throw new Error('No response from import function');
      }

      // Update progress based on response step
      setCurrentStep(data.step);

      if (data.success && data.recordingId && data.title) {
        onSuccess(data.recordingId, data.title);
      } else if (data.exists && data.recordingId && data.title) {
        // Video already imported - treat as special case
        setError(`This video has already been imported as "${data.title}"`);
        setCurrentStep('error');
        onError(`Video already imported`);
      } else if (data.error) {
        setError(data.error);
        setCurrentStep('error');
        onError(data.error);
      }
    } catch (err) {
      // Stop simulated progress on error
      cancelled = true;
      timeoutIds.forEach(clearTimeout);

      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      setCurrentStep('error');
      onError(errorMessage);
    } finally {
      setIsImporting(false);
    }
  }, [url, selectedVaultId, onSuccess, onError]);

  const handleReset = useCallback(() => {
    setUrl('');
    setCurrentStep('idle');
    setError(undefined);
    // Keep selectedVaultId — user likely wants same vault for next import
  }, []);

  const isValid = url.trim().length > 0 && isValidYouTubeInput(url.trim());

  return (
    <div className={cn("space-y-6", className)}>
      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Input field */}
        <div className="space-y-2">
          <label
            htmlFor="youtube-url"
            className="text-sm font-medium text-foreground flex items-center gap-2"
          >
            <RiYoutubeLine className="w-4 h-4 text-red-600" />
            YouTube URL
          </label>
          <div className="relative">
            <RiLink className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="youtube-url"
              type="text"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (error) setError(undefined);
                if (currentStep !== 'idle') setCurrentStep('idle');
              }}
              onPaste={handlePaste}
              placeholder="Paste YouTube URL here..."
              className={cn(
                "pl-10 pr-4 h-12 text-base",
                error && "border-destructive focus-visible:ring-destructive"
              )}
              disabled={isImporting}
              autoComplete="off"
              autoFocus
            />
          </div>
          
          {/* Format hints */}
          <p className="text-xs text-muted-foreground">
            Supported formats: youtube.com/watch?v=..., youtu.be/..., or 11-character video ID
          </p>
        </div>

        {/* Vault selector */}
        <VaultSelector
          integration="youtube"
          value={selectedVaultId}
          onVaultChange={setSelectedVaultId}
          disabled={isImporting}
        />

        {/* Submit button */}
        <Button
          type="submit"
          disabled={!isValid || isImporting}
          className="w-full h-11"
        >
          {isImporting ? (
            <>
              Importing...
            </>
          ) : (
            <>
              Import Video
              <RiArrowRightLine className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>
      </form>

      {/* Progress indicator */}
      <ImportProgress 
        currentStep={currentStep} 
        error={error}
        className="pt-2"
      />

      {/* Reset button when done or error */}
      {(currentStep === 'done' || currentStep === 'error') && (
        <div className="flex justify-center pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={handleReset}
            className="text-muted-foreground hover:text-foreground"
          >
            Import Another Video
          </Button>
        </div>
      )}
    </div>
  );
}
