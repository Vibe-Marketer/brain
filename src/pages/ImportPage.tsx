import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  RiCloudLine,
  RiVideoLine,
  RiYoutubeLine,
  RiUploadCloud2Line,
  RiGlobalLine,
  RiFireLine,
  RiDownloadCloud2Line,
} from '@remixicon/react';
import * as Dialog from '@radix-ui/react-dialog';
import { supabase } from '@/integrations/supabase/client';
import { AppShell } from '@/components/layout/AppShell';
import { SourceCard } from '@/components/import/SourceCard';
import type { SourceStatus } from '@/components/import/SourceCard';
import { ImportSourceGrid } from '@/components/import/ImportSourceGrid';
import { FileUploadDropzone } from '@/components/import/FileUploadDropzone';
import { FailedImportsSection } from '@/components/import/FailedImportsSection';
import { RoutingRulesTab } from '@/components/import/RoutingRulesTab';
import { useImportSources, useImportCounts, useToggleSource, useDisconnectSource } from '@/hooks/useImportSources';
import { upsertImportSource } from '@/services/import-sources.service';
import type { ImportSource } from '@/services/import-sources.service';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/ui/page-header';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

// OAuth URL edge functions
async function connectFathom() {
  const { data, error } = await supabase.functions.invoke('fathom-oauth-url');
  if (error || !data?.authUrl) {
    toast.error('Failed to start Fathom connection');
    return;
  }
  window.location.href = data.authUrl as string;
}

async function connectZoom() {
  const { data, error } = await supabase.functions.invoke('zoom-oauth-url');
  if (error || !data?.authUrl) {
    toast.error('Failed to start Zoom connection');
    return;
  }
  window.location.href = data.authUrl as string;
}

interface AddSourceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function AddSourceDialog({ open, onOpenChange }: AddSourceDialogProps) {
  const comingSoon = [
    { name: 'Grain', icon: <RiGlobalLine size={16} />, description: 'AI meeting recorder' },
    { name: 'Fireflies', icon: <RiFireLine size={16} />, description: 'Meeting transcription' },
  ];

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-in fade-in duration-200" />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50',
            'w-full max-w-sm',
            'bg-background border border-border rounded-xl shadow-2xl',
            'animate-in zoom-in-95 fade-in duration-200',
            'focus:outline-none p-5',
          )}
        >
          <Dialog.Title className="font-display font-extrabold text-base uppercase tracking-wide text-foreground mb-1">
            Add Source
          </Dialog.Title>
          <Dialog.Description className="text-xs text-muted-foreground mb-5">
            More connectors are coming soon.
          </Dialog.Description>

          <div className="space-y-2">
            {comingSoon.map((source) => (
              <div
                key={source.name}
                className="flex items-center gap-3 rounded-lg border border-border/40 bg-muted/30 px-3 py-2.5 opacity-60"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  {source.icon}
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground">{source.name}</p>
                  <p className="text-[11px] text-muted-foreground">{source.description}</p>
                </div>
                <span className="ml-auto text-[11px] text-muted-foreground">Coming soon</span>
              </div>
            ))}
          </div>

          <Dialog.Close asChild>
            <button
              type="button"
              className={cn(
                'mt-5 w-full rounded-lg border border-border py-2',
                'text-xs font-medium text-foreground',
                'hover:bg-muted/60 transition-colors',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              )}
            >
              Close
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function deriveStatus(source: ImportSource | undefined): SourceStatus {
  if (!source) return 'disconnected';
  if (source.error_message) return 'error';
  if (!source.is_active) return 'paused';
  return 'active';
}

type ActiveTab = 'sources' | 'rules';

export default function ImportPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('sources');
  const [addSourceOpen, setAddSourceOpen] = useState(false);
  const [youtubeDialogOpen, setYoutubeDialogOpen] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [youtubeLoading, setYoutubeLoading] = useState(false);

  const { data: sources = [], isLoading: sourcesLoading } = useImportSources();
  const { data: counts = {} } = useImportCounts();
  const toggleSource = useToggleSource();
  const disconnectSource = useDisconnectSource();

  const sourceByApp = Object.fromEntries(sources.map((s) => [s.source_app, s]));

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connectedSource = params.get('source');
    const wasConnected = params.get('connected') === 'true';
    const accountEmail = params.get('email') ?? undefined;

    if (!connectedSource || !wasConnected) return;

    window.history.replaceState({}, '', window.location.pathname);

    async function handleOAuthReturn() {
      if (!connectedSource) return;
      try {
        await upsertImportSource({ source_app: connectedSource, account_email: accountEmail });
        toast.success(`Connected ${connectedSource}! Syncing your calls…`);

        const syncFnMap: Record<string, string> = {
          fathom: 'sync-meetings',
          zoom: 'zoom-sync-meetings',
        };
        const fnName = syncFnMap[connectedSource];
        if (fnName) {
          const { data } = await supabase.functions.invoke(fnName);
          const synced = (data as { synced_count?: number } | null)?.synced_count ?? 0;
          const sourceName = connectedSource === 'fathom' ? 'Fathom' : 'Zoom';
          if (synced > 0) {
            toast.success(`${sourceName} sync complete — ${synced} new calls imported`);
          }
        }
      } catch (err) {
        toast.error(`Sync failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    void handleOAuthReturn();
  }, []);

  async function handleYoutubeImport(e: React.FormEvent) {
    e.preventDefault();
    if (!youtubeUrl.trim()) return;
    setYoutubeLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('youtube-import', {
        body: { videoUrl: youtubeUrl.trim() },
      });
      if (error) throw error;
      const res = data as { recordingId?: string; title?: string } | null;
      toast.success(res?.title ? `Imported "${res.title}" from YouTube` : 'YouTube import complete');
      setYoutubeUrl('');
      setYoutubeDialogOpen(false);
    } catch (err) {
      toast.error(`Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setYoutubeLoading(false);
    }
  }

  async function handleFathomSync() {
    const toastId = toast.loading('Fetching meetings from Fathom...');
    try {
      // 1. Fetch recent meetings
      const { data: fetchRes, error: fetchErr } = await supabase.functions.invoke('fetch-meetings', {
        body: {} // Pass empty body to prevent JSON parse errors
      });
      if (fetchErr) throw fetchErr;

      const meetings = fetchRes?.meetings || [];
      const unsyncedIds = meetings
        .filter((m: { synced: boolean }) => !m.synced)
        .map((m: { recording_id: number | string }) => String(m.recording_id));

      if (unsyncedIds.length === 0) {
        toast.success('All recent Fathom meetings are already synced.', { id: toastId });
        return;
      }

      toast.loading(`Syncing ${unsyncedIds.length} missing meetings...`, { id: toastId });

      // 2. Start the sync job
      const { data, error } = await supabase.functions.invoke('sync-meetings', {
        body: { recordingIds: unsyncedIds }
      });
      if (error) throw error;
      
      const jobId = (data as { jobId?: string } | null)?.jobId;
      if (jobId) {
        toast.success(`Started sync job for ${unsyncedIds.length} meetings. Background processing in progress.`, { id: toastId });
      } else {
        toast.success(`Fathom sync complete — ${unsyncedIds.length} new calls imported`, { id: toastId });
      }
    } catch (err) {
      toast.error(`Sync failed: ${err instanceof Error ? err.message : 'Unknown error'}`, { id: toastId });
    }
  }

  async function handleZoomSync() {
    const toastId = toast.loading('Fetching meetings from Zoom...');
    try {
      // 1. Fetch recent meetings
      const { data: fetchRes, error: fetchErr } = await supabase.functions.invoke('zoom-fetch-meetings', {
        body: {} // Pass empty body to prevent JSON parse errors
      });
      if (fetchErr) throw fetchErr;

      const meetings = fetchRes?.meetings || [];
      const unsyncedIds = meetings
        .filter((m: { synced: boolean }) => !m.synced)
        .map((m: { recording_id: string }) => m.recording_id);

      if (unsyncedIds.length === 0) {
        toast.success('All recent Zoom meetings are already synced.', { id: toastId });
        return;
      }

      toast.loading(`Syncing ${unsyncedIds.length} missing meetings...`, { id: toastId });

      // 2. Start the sync job
      const { data, error } = await supabase.functions.invoke('zoom-sync-meetings', {
        body: { recordingIds: unsyncedIds }
      });
      if (error) throw error;
      
      const jobId = (data as { jobId?: string } | null)?.jobId;
      if (jobId) {
        toast.success(`Started sync job for ${unsyncedIds.length} meetings. Background processing in progress.`, { id: toastId });
      } else {
        toast.success(`Zoom sync complete — ${unsyncedIds.length} new calls imported`, { id: toastId });
      }
    } catch (err) {
      toast.error(`Sync failed: ${err instanceof Error ? err.message : 'Unknown error'}`, { id: toastId });
    }
  }


  const fathomRow = sourceByApp['fathom'];
  const zoomRow = sourceByApp['zoom'];
  const youtubeRow = sourceByApp['youtube'];

  return (
    <AppShell>
      <div className="flex flex-col h-full overflow-hidden">
        <PageHeader
          title="Import Hub"
          subtitle="Connect meeting sources and upload recordings"
          icon={RiDownloadCloud2Line}
        />

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as ActiveTab)}
            className="flex flex-col h-full"
          >
            <TabsList className="mb-6">
              <TabsTrigger value="sources">Connected Sources</TabsTrigger>
              <TabsTrigger value="rules">Routing Rules</TabsTrigger>
            </TabsList>

            <TabsContent value="sources" className="space-y-10 focus-visible:ring-0">
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">Import Connectors</h2>
                    <p className="text-xs text-muted-foreground">Automatic background sync from third-party tools</p>
                  </div>
                </div>

                {sourcesLoading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className="h-36 rounded-xl border border-border/40 bg-muted/30 animate-pulse"
                      />
                    ))}
                  </div>
                ) : (
                  <ImportSourceGrid onAddSource={() => setAddSourceOpen(true)}>
                    <SourceCard
                      name="Fathom"
                      sourceApp="fathom"
                      icon={<RiCloudLine size={18} />}
                      status={deriveStatus(fathomRow)}
                      accountEmail={fathomRow?.account_email ?? undefined}
                      lastSyncAt={fathomRow?.last_sync_at}
                      callCount={counts['fathom'] ?? 0}
                      isActive={fathomRow?.is_active ?? false}
                      errorMessage={fathomRow?.error_message}
                      onToggle={(active) => {
                        if (fathomRow) {
                          toggleSource.mutate({ sourceId: fathomRow.id, isActive: active });
                        }
                      }}
                      onConnect={connectFathom}
                      onSync={fathomRow ? handleFathomSync : undefined}
                      onDisconnect={
                        fathomRow
                          ? () => disconnectSource.mutate(fathomRow.id)
                          : undefined
                      }
                    />

                    <SourceCard
                      name="Zoom"
                      sourceApp="zoom"
                      icon={<RiVideoLine size={18} />}
                      status={deriveStatus(zoomRow)}
                      accountEmail={zoomRow?.account_email ?? undefined}
                      lastSyncAt={zoomRow?.last_sync_at}
                      callCount={counts['zoom'] ?? 0}
                      isActive={zoomRow?.is_active ?? false}
                      errorMessage={zoomRow?.error_message}
                      onToggle={(active) => {
                        if (zoomRow) {
                          toggleSource.mutate({ sourceId: zoomRow.id, isActive: active });
                        }
                      }}
                      onConnect={connectZoom}
                      onSync={zoomRow ? handleZoomSync : undefined}
                      onDisconnect={
                        zoomRow
                          ? () => disconnectSource.mutate(zoomRow.id)
                          : undefined
                      }
                    />

                    <SourceCard
                      name="YouTube"
                      sourceApp="youtube"
                      icon={<RiYoutubeLine size={18} />}
                      status={deriveStatus(youtubeRow)}
                      accountEmail={youtubeRow?.account_email ?? undefined}
                      lastSyncAt={youtubeRow?.last_sync_at}
                      callCount={counts['youtube'] ?? 0}
                      isActive={youtubeRow?.is_active ?? true}
                      errorMessage={youtubeRow?.error_message}
                      onToggle={async (active) => {
                        if (youtubeRow) {
                          toggleSource.mutate({ sourceId: youtubeRow.id, isActive: active });
                        } else {
                          try {
                            await upsertImportSource({ source_app: 'youtube' });
                          } catch {
                            toast.error('Failed to update YouTube setting');
                          }
                        }
                      }}
                      onSync={() => setYoutubeDialogOpen(true)}
                    />


                    <SourceCard
                      name="File Upload"
                      sourceApp="file-upload"
                      icon={<RiUploadCloud2Line size={18} />}
                      status="active"
                      callCount={counts['file-upload'] ?? 0}
                      isActive={true}
                      onToggle={() => {
                        toast.info('File upload is always available');
                      }}
                    />
                  </ImportSourceGrid>
                )}
              </section>

              <section className="space-y-4">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Direct Upload</h2>
                  <p className="text-xs text-muted-foreground">Import audio or video files directly for transcription</p>
                </div>
                <FileUploadDropzone />
              </section>

              <FailedImportsSection />
            </TabsContent>

            <TabsContent value="rules" className="pb-10 focus-visible:ring-0">
              <RoutingRulesTab />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <AddSourceDialog open={addSourceOpen} onOpenChange={setAddSourceOpen} />

      <Dialog.Root open={youtubeDialogOpen} onOpenChange={setYoutubeDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-in fade-in duration-200" />
          <Dialog.Content
            className={cn(
              'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50',
              'w-full max-w-sm',
              'bg-background border border-border rounded-xl shadow-2xl p-5',
              'animate-in zoom-in-95 fade-in duration-200',
              'focus:outline-none',
            )}
          >
            <Dialog.Title className="font-display font-extrabold text-base uppercase tracking-wide text-foreground mb-1">
              Import from YouTube
            </Dialog.Title>
            <Dialog.Description className="text-xs text-muted-foreground mb-4">
              Paste a YouTube video URL to import and transcribe.
            </Dialog.Description>
            <form onSubmit={handleYoutubeImport} className="space-y-3">
              <input
                type="url"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
                required
                className={cn(
                  'w-full rounded-lg border border-border bg-muted/30 px-3 py-2',
                  'text-sm text-foreground placeholder:text-muted-foreground/60',
                  'focus:outline-none focus:ring-2 focus:ring-vibe-orange focus:border-transparent',
                  'transition-colors',
                )}
              />
              <div className="flex gap-2">
                <Dialog.Close asChild>
                  <button
                    type="button"
                    className={cn(
                      'flex-1 rounded-lg border border-border py-2',
                      'text-xs font-medium text-foreground',
                      'hover:bg-muted/60 transition-colors',
                      'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    )}
                  >
                    Cancel
                  </button>
                </Dialog.Close>
                <button
                  type="submit"
                  disabled={youtubeLoading || !youtubeUrl.trim()}
                  className={cn(
                    'flex-1 rounded-lg bg-vibe-orange py-2',
                    'text-xs font-semibold uppercase tracking-wide text-white',
                    'hover:bg-vibe-orange-dark transition-colors',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  )}
                >
                  {youtubeLoading ? 'Importing…' : 'Import'}
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </AppShell>
  );
}
