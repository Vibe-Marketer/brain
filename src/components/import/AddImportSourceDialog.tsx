/**
 * AddImportSourceDialog — Phase 36-06 BUG-07
 *
 * Triggered by the "+" button on ImportSourcePane. Lets the user pick a
 * source to add: Fathom, Zoom, YouTube, File Upload, or Paste Transcript.
 * Each tile, when clicked, closes the dialog and either kicks off the
 * source-specific OAuth flow (Fathom/Zoom) or navigates to the in-app
 * import surface (YouTube/File Upload/Paste).
 */

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import {
  RiCloudLine,
  RiVideoLine,
  RiYoutubeLine,
  RiUploadCloud2Line,
  RiClipboardLine,
} from '@remixicon/react';
import { cn } from '@/lib/utils';

export type AddImportSourceChoice =
  | 'fathom'
  | 'zoom'
  | 'fireflies'
  | 'plaud'
  | 'youtube'
  | 'file-upload'
  | 'paste-transcript';

interface SourceTile {
  id: AddImportSourceChoice;
  label: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TILES: SourceTile[] = [
  { id: 'fathom', label: 'Fathom', subtitle: 'Connect your Fathom account via OAuth', icon: RiCloudLine },
  { id: 'zoom', label: 'Zoom', subtitle: 'Connect Zoom Cloud Recordings via OAuth', icon: RiVideoLine },
  { id: 'fireflies', label: 'Fireflies', subtitle: 'Import Fireflies transcripts with an API key', icon: RiCloudLine },
  { id: 'plaud', label: 'Plaud', subtitle: 'Connect Plaud recordings with a web access token', icon: RiCloudLine },
  { id: 'youtube', label: 'YouTube', subtitle: 'Import calls from public YouTube URLs', icon: RiYoutubeLine },
  { id: 'file-upload', label: 'File Upload', subtitle: 'Upload audio or video files directly', icon: RiUploadCloud2Line },
  { id: 'paste-transcript', label: 'Paste Transcript', subtitle: 'Manually paste or upload a transcript', icon: RiClipboardLine },
];

export interface AddImportSourceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (choice: AddImportSourceChoice) => void;
}

export function AddImportSourceDialog({
  open,
  onOpenChange,
  onSelect,
}: AddImportSourceDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogTitle className="text-lg font-semibold">
          Add Import Source
        </DialogTitle>
        <DialogDescription>
          Pick where your calls or transcripts will come from.
        </DialogDescription>

        <div className="grid grid-cols-1 gap-2 mt-4">
          {TILES.map(({ id, label, subtitle, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                onSelect(id);
                onOpenChange(false);
              }}
              className={cn(
                'flex items-start gap-3 p-3 rounded-lg text-left',
                'border border-border bg-card',
                'hover:bg-muted/60 hover:border-foreground/20 transition-colors',
                'focus:outline-none focus:ring-2 focus:ring-vibe-orange/40',
              )}
            >
              <div className="w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0 bg-muted">
                <Icon className="h-4 w-4 text-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground">{label}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{subtitle}</div>
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default AddImportSourceDialog;
