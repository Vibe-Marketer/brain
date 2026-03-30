import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import {
  RiYoutubeLine,
  RiUploadCloud2Line,
  RiDownloadCloud2Line,
} from '@remixicon/react';
import { supabase } from '@/integrations/supabase/client';
import { AppShell } from '@/components/layout/AppShell';
import { FileUploadDropzone } from '@/components/import/FileUploadDropzone';
import { FailedImportsSection } from '@/components/import/FailedImportsSection';
import { RoutingRulesTab } from '@/components/import/RoutingRulesTab';
import { YouTubeImportForm } from '@/components/import/YouTubeImportForm';
import { FathomImportDetail } from '@/components/import/FathomImportDetail';
import { ZoomImportDetail } from '@/components/import/ZoomImportDetail';
import { ImportSourcePane } from '@/components/panes/ImportSourcePane';
import type { ImportSourceId } from '@/components/panes/ImportSourcePane';
import { ImportOverviewDashboard } from '@/components/import/ImportOverviewDashboard';
import { useImportSources, useImportCounts, useDisconnectSource, useFailedImports } from '@/hooks/useImportSources';
import { upsertImportSource } from '@/services/import-sources.service';
import type { ImportSource } from '@/services/import-sources.service';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';

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

export default function ImportPage() {
  const [selectedSource, setSelectedSource] = useState<ImportSourceId | null>(null);
  const [disconnectTarget, setDisconnectTarget] = useState<ImportSource | null>(null);

  const { data: sources = [], isLoading: sourcesLoading } = useImportSources();
  const { data: counts = {} } = useImportCounts();
  const { data: failedImports = [] } = useFailedImports();
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
        <FathomImportDetail
          isConnected={!!(fathomRow && fathomRow.is_active)}
          accountEmail={fathomRow?.account_email ?? undefined}
          onConnect={connectFathom}
          onDisconnect={fathomRow ? () => setDisconnectTarget(fathomRow) : undefined}
        />
      );
    }

    if (selectedSource === 'zoom') {
      return (
        <ZoomImportDetail
          isConnected={!!(zoomRow && zoomRow.is_active)}
          accountEmail={zoomRow?.account_email ?? undefined}
          onConnect={connectZoom}
          onDisconnect={zoomRow ? () => setDisconnectTarget(zoomRow) : undefined}
        />
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
    <>
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

      <AlertDialog.Root open={!!disconnectTarget} onOpenChange={(open) => !open && setDisconnectTarget(null)}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
          <AlertDialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md rounded-xl bg-card p-6 shadow-lg border border-border">
            <AlertDialog.Title className="text-lg font-semibold text-foreground">
              Disconnect {disconnectTarget?.source_app === 'fathom' ? 'Fathom' : 'Zoom'}?
            </AlertDialog.Title>
            <AlertDialog.Description className="text-sm text-muted-foreground mt-2">
              Your imported calls will remain in CallVault. You can reconnect at any time.
            </AlertDialog.Description>
            <div className="flex justify-end gap-3 mt-6">
              <AlertDialog.Cancel asChild>
                <Button variant="hollow">Cancel</Button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <Button variant="destructive" onClick={() => {
                  if (disconnectTarget) {
                    disconnectSource.mutate(disconnectTarget.id);
                    setDisconnectTarget(null);
                  }
                }}>
                  Disconnect
                </Button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </>
  );
}
