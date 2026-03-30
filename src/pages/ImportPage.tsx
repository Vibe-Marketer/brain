import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  RiCloudLine,
  RiVideoLine,
  RiYoutubeLine,
  RiUploadCloud2Line,
  RiDownloadCloud2Line,
} from '@remixicon/react';
import { supabase } from '@/integrations/supabase/client';
import { AppShell } from '@/components/layout/AppShell';
import { SourceCard } from '@/components/import/SourceCard';
import type { SourceStatus } from '@/components/import/SourceCard';
import { FileUploadDropzone } from '@/components/import/FileUploadDropzone';
import { FailedImportsSection } from '@/components/import/FailedImportsSection';
import { RoutingRulesTab } from '@/components/import/RoutingRulesTab';
import { YouTubeImportForm } from '@/components/import/YouTubeImportForm';
import { ImportSourcePane } from '@/components/panes/ImportSourcePane';
import type { ImportSourceId } from '@/components/panes/ImportSourcePane';
import { ImportOverviewDashboard } from '@/components/import/ImportOverviewDashboard';
import { useImportSources, useImportCounts, useToggleSource, useDisconnectSource, useFailedImports } from '@/hooks/useImportSources';
import { upsertImportSource } from '@/services/import-sources.service';
import type { ImportSource } from '@/services/import-sources.service';
import { PageHeader } from '@/components/ui/page-header';

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

function deriveStatus(source: ImportSource | undefined): SourceStatus {
  if (!source) return 'disconnected';
  if (source.error_message) return 'error';
  if (!source.is_active) return 'paused';
  return 'active';
}

export default function ImportPage() {
  const [selectedSource, setSelectedSource] = useState<ImportSourceId | null>(null);

  const { data: sources = [], isLoading: sourcesLoading } = useImportSources();
  const { data: counts = {} } = useImportCounts();
  const { data: failedImports = [] } = useFailedImports();
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

  async function handleFathomSync() {
    const toastId = toast.loading('Fetching recent meetings from Fathom...');
    try {
      const createdAfter = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const { data: fetchRes, error: fetchErr } = await supabase.functions.invoke('fetch-meetings', {
        body: { createdAfter }
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
      const { data: fetchRes, error: fetchErr } = await supabase.functions.invoke('zoom-fetch-meetings', {
        body: {}
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

  // Pane 3 content based on selected source
  function renderPane3() {
    if (!selectedSource) {
      return (
        <ImportOverviewDashboard
          sources={sources}
          counts={counts}
          failedImports={failedImports}
          onSelectSource={(id) => setSelectedSource(id as ImportSourceId)}
        />
      );
    }

    if (selectedSource === 'fathom') {
      return (
        <div className="flex flex-col h-full overflow-y-auto">
          <PageHeader
            title="Fathom"
            subtitle={fathomRow ? `Connected as ${fathomRow.account_email ?? 'unknown'}` : 'Not connected'}
            icon={RiCloudLine}
          />
          <div className="px-6 py-4">
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
          </div>
        </div>
      );
    }

    if (selectedSource === 'zoom') {
      return (
        <div className="flex flex-col h-full overflow-y-auto">
          <PageHeader
            title="Zoom"
            subtitle={zoomRow ? `Connected as ${zoomRow.account_email ?? 'unknown'}` : 'Not connected'}
            icon={RiVideoLine}
          />
          <div className="px-6 py-4">
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
          </div>
        </div>
      );
    }

    if (selectedSource === 'youtube') {
      return (
        <div className="flex flex-col h-full overflow-y-auto">
          <PageHeader
            title="YouTube"
            subtitle="Import calls from YouTube URLs"
            icon={RiYoutubeLine}
          />
          <div className="px-6 py-4 max-w-xl">
            <YouTubeImportForm
              onSuccess={(_id, title) => {
                toast.success(`Imported "${title}" successfully from YouTube`);
              }}
              onError={(err) => {
                toast.error(`Import failed: ${err}`);
              }}
            />
          </div>
        </div>
      );
    }

    if (selectedSource === 'file-upload') {
      return (
        <div className="flex flex-col h-full overflow-y-auto">
          <PageHeader
            title="File Upload"
            subtitle="Import audio or video files directly for transcription"
            icon={RiUploadCloud2Line}
          />
          <div className="px-6 py-4">
            <FileUploadDropzone />
          </div>
        </div>
      );
    }

    if (selectedSource === 'routing-rules') {
      return (
        <div className="flex flex-col h-full overflow-y-auto">
          <PageHeader
            title="Routing Rules"
            subtitle="Auto-tag and sort calls as they are imported"
            icon={RiDownloadCloud2Line}
          />
          <div className="px-6 py-4">
            <RoutingRulesTab />
          </div>
        </div>
      );
    }

    if (selectedSource === 'import-history') {
      return (
        <div className="flex flex-col h-full overflow-y-auto">
          <PageHeader
            title="Import History"
            subtitle="Review recent imports and failed jobs"
            icon={RiDownloadCloud2Line}
          />
          <div className="px-6 py-4">
            <FailedImportsSection />
          </div>
        </div>
      );
    }

    return null;
  }

  return (
    <AppShell
      secondaryPane={
        <ImportSourcePane
          selectedSource={selectedSource}
          onSelectSource={setSelectedSource}
          sources={sources}
          sourcesLoading={sourcesLoading}
        />
      }
      secondaryPaneTitle="Import Sources"
    >
      {renderPane3()}
    </AppShell>
  );
}
