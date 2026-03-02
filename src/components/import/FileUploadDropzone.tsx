/**
 * FileUploadDropzone — Drag-and-drop file upload for Whisper transcription.
 */

import { useRef, useState, useCallback } from 'react';
import { RiUploadCloud2Line } from '@remixicon/react';
import { cn } from '@/lib/utils';
import { useFileUpload } from '@/hooks/useImportSources';

const ACCEPTED_MIME_TYPES = new Set([
  'audio/mpeg',
  'audio/wav',
  'audio/x-wav',
  'audio/mp4',
  'audio/x-m4a',
  'video/mp4',
  'video/quicktime',
  'video/webm',
]);

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25MB

const ACCEPT_ATTR =
  'audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/x-m4a,video/mp4,video/quicktime,video/webm';

type FileUploadState = 'idle' | 'uploading' | 'done' | 'error';

interface FileEntry {
  id: string;
  name: string;
  state: FileUploadState;
  error?: string;
}

function validateFile(file: File): string | null {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `File exceeds 25MB limit`;
  }
  if (!ACCEPTED_MIME_TYPES.has(file.type)) {
    return `Unsupported format. Accepted: MP3, WAV, M4A, MP4, MOV, WebM`;
  }
  return null;
}

export function FileUploadDropzone() {
  const [isDragOver, setIsDragOver] = useState(false);
  const [fileEntries, setFileEntries] = useState<FileEntry[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadMutation = useFileUpload();

  const processFiles = useCallback(
    (files: FileList | File[]) => {
      const fileList = Array.from(files);
      for (const file of fileList) {
        const validationError = validateFile(file);
        const id = `${file.name}-${Date.now()}-${Math.random()}`;

        if (validationError) {
          setFileEntries((prev) => [
            ...prev,
            { id, name: file.name, state: 'error', error: validationError },
          ]);
          continue;
        }

        setFileEntries((prev) => [...prev, { id, name: file.name, state: 'uploading' }]);

        uploadMutation.mutate(file, {
          onSuccess: () => {
            setFileEntries((prev) =>
              prev.map((entry) => (entry.id === id ? { ...entry, state: 'done' } : entry))
            );
          },
          onError: (err: Error) => {
            setFileEntries((prev) =>
              prev.map((entry) =>
                entry.id === id
                  ? { ...entry, state: 'error', error: err.message }
                  : entry
              )
            );
          },
        });
      }
    },
    [uploadMutation]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload audio or video file"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
        }}
        className={cn(
          'flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8',
          'cursor-pointer select-none transition-colors',
          isDragOver
            ? 'border-brand-400 bg-brand-400/5'
            : 'border-border/60 bg-muted/30 hover:border-border hover:bg-muted/50',
        )}
      >
        <RiUploadCloud2Line
          size={28}
          className={cn(
            'transition-colors',
            isDragOver ? 'text-brand-400' : 'text-muted-foreground',
          )}
          aria-hidden="true"
        />
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">
            {isDragOver ? 'Drop files here' : 'Drag audio or video files here'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            or{' '}
            <span className="text-brand-400 hover:underline">click to browse</span>
          </p>
          <p className="mt-2 text-[11px] text-muted-foreground">
            MP3, WAV, M4A, MP4, MOV, WebM · Max 25MB
          </p>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ACCEPT_ATTR}
        onChange={handleInputChange}
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
      />

      {fileEntries.length > 0 && (
        <ul className="space-y-1.5">
          {fileEntries.map((entry) => (
            <li
              key={entry.id}
              className={cn(
                'flex items-center gap-2.5 rounded-lg border px-3 py-2 text-xs',
                entry.state === 'done' && 'border-emerald-500/30 bg-emerald-500/5',
                entry.state === 'error' && 'border-red-500/30 bg-red-500/5',
                entry.state === 'uploading' && 'border-border/60 bg-muted/30',
              )}
            >
              <span
                className={cn(
                  'h-2 w-2 rounded-full shrink-0',
                  entry.state === 'done' && 'bg-emerald-500',
                  entry.state === 'error' && 'bg-red-500',
                  entry.state === 'uploading' && 'bg-brand-400 animate-pulse',
                )}
              />
              <span className="flex-1 truncate text-foreground">{entry.name}</span>
              <span
                className={cn(
                  'shrink-0',
                  entry.state === 'done' && 'text-emerald-500',
                  entry.state === 'error' && 'text-red-500',
                  entry.state === 'uploading' && 'text-muted-foreground',
                )}
              >
                {entry.state === 'uploading' && 'Uploading…'}
                {entry.state === 'done' && 'Done'}
                {entry.state === 'error' && (entry.error ?? 'Error')}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
