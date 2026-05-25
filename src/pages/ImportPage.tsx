import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-config";
import { toast } from "sonner";
import {
  RiYoutubeLine,
  RiUploadCloud2Line,
  RiDownloadCloud2Line,
  RiClipboardLine,
} from "@remixicon/react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { usePanelStore } from "@/stores/panelStore";
import { useOrgContext } from "@/hooks/useOrgContext";
import { FileUploadDropzone } from "@/components/import/FileUploadDropzone";
import { RoutingRulesTab } from "@/components/import/RoutingRulesTab";
import { YouTubeImportForm } from "@/components/import/YouTubeImportForm";
import { PasteTranscriptModal } from "@/components/import/PasteTranscriptModal";
import {
  AddImportSourceDialog,
  type AddImportSourceChoice,
} from "@/components/import/AddImportSourceDialog";
import { ImportHistoryPanel } from "@/components/import/ImportHistoryPanel";
import { ImportSourcePane } from "@/components/panes/ImportSourcePane";
import type { ImportSourceId } from "@/components/panes/ImportSourcePane";
import { ImportOverviewDashboard } from "@/components/import/ImportOverviewDashboard";
import { ConnectorImportWizard } from "@/components/connectors/ConnectorImportWizard";
import type { ConnectorSourceApp } from "@/components/connectors/registry/types";
import {
  useImportSources,
  useImportCounts,
  useFailedImports,
} from "@/hooks/useImportSources";
import { upsertImportSource } from "@/services/import-sources.service";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";

export default function ImportPage() {
  const queryClient = useQueryClient();
  const [selectedSource, setSelectedSource] = useState<ImportSourceId | null>(
    null,
  );
  const [pasteModalOpen, setPasteModalOpen] = useState(false);
  // Phase 36-06 BUG-07: dialog opened by the "+" button in the import source pane
  const [addSourceDialogOpen, setAddSourceDialogOpen] = useState(false);
  const { closePanel } = usePanelStore();
  const { activeOrgId } = useOrgContext();

  // Close Pane 4 when switching import source tabs (unless pinned)
  useEffect(() => {
    closePanel();
  }, [selectedSource, closePanel]);

  const { data: sources = [], isLoading: sourcesLoading } = useImportSources();
  const { data: counts = {} } = useImportCounts();
  const { data: failedImports = [] } = useFailedImports();
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connectedSource = params.get("source");
    const wasConnected = params.get("connected") === "true";
    const accountEmail = params.get("email") ?? undefined;
    const sourceId = params.get("sourceId") ?? undefined;

    if (!connectedSource || !wasConnected) return;

    window.history.replaceState({}, "", window.location.pathname);

    async function handleOAuthReturn() {
      if (!connectedSource) return;
      try {
        await upsertImportSource({
          source_app: connectedSource,
          account_email: accountEmail,
          source_id: sourceId,
        });
        toast.success(`Connected ${connectedSource}! Syncing your calls…`);

        const syncFnMap: Record<string, string> = {
          fathom: "sync-meetings",
          zoom: "zoom-sync-meetings",
          plaud: "plaud-sync-recordings",
        };
        const fnName = syncFnMap[connectedSource];
        if (fnName) {
          const { data } = await supabase.functions.invoke(fnName, {
            body: sourceId ? { sourceId } : undefined,
          });
          const synced =
            (data as { synced_count?: number } | null)?.synced_count ?? 0;
          const sourceName =
            connectedSource === "fathom"
              ? "Fathom"
              : connectedSource === "zoom"
                ? "Zoom"
                : "Plaud";
          if (synced > 0) {
            toast.success(
              `${sourceName} sync complete — ${synced} new calls imported`,
            );
          }
        }
      } catch (err) {
        toast.error(
          `Sync failed: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      }
    }

    void handleOAuthReturn();
  }, []);

  // Pane 3 content based on selected source
  function renderPane3() {
    if (!selectedSource) {
      return (
        <div className="relative h-full">
          {/* Floating Save Transcript CTA — Phase 24 paste flow.
              Positioned over the overview dashboard's PageHeader so it sits
              with the other page-level actions. */}
          <div className="absolute right-4 top-3 z-10">
            <Button
              variant="hollow"
              size="sm"
              onClick={() => setPasteModalOpen(true)}
              disabled={!activeOrgId}
            >
              <RiClipboardLine className="h-4 w-4 mr-2" aria-hidden="true" />
              Save Transcript
            </Button>
          </div>
          <ImportOverviewDashboard
            counts={counts}
            failedImports={failedImports}
            onSelectSource={(id) => setSelectedSource(id as ImportSourceId)}
          />
        </div>
      );
    }

    if (isWizardImportSource(selectedSource)) {
      return (
        <div className="flex flex-col h-full overflow-y-auto">
          <div className="px-6 py-4">
            <ConnectorImportWizard
              sourceApp={selectedSource}
              onImportComplete={() => {
                queryClient.invalidateQueries({ queryKey: queryKeys.calls.all });
                queryClient.invalidateQueries({
                  queryKey: queryKeys.imports.counts(),
                });
                queryClient.invalidateQueries({
                  queryKey: queryKeys.imports.failed(),
                });
              }}
            />
          </div>
        </div>
      );
    }

    if (selectedSource === "youtube") {
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
                queryClient.invalidateQueries({
                  queryKey: queryKeys.calls.all,
                });
                queryClient.invalidateQueries({
                  queryKey: ["workspace-entries"],
                });
              }}
              onError={(err) => {
                toast.error(`Import failed: ${err}`);
              }}
            />
          </div>
        </div>
      );
    }

    if (selectedSource === "file-upload") {
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

    if (selectedSource === "routing-rules") {
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

    if (selectedSource === "import-history") {
      // Phase 36-06 BUG-06: real Import History panel (not just failed imports)
      return <ImportHistoryPanel />;
    }

    if (selectedSource === "paste-transcript") {
      // Phase 36-06 BUG-05: dedicated paste-transcript surface in import detail view
      return (
        <div className="flex flex-col h-full overflow-y-auto">
          <PageHeader
            title="Paste Transcript"
            subtitle="Manually paste a transcript or upload an audio/video file"
            icon={RiClipboardLine}
          />
          <div className="px-6 py-4 max-w-xl">
            <Button
              variant="default"
              onClick={() => setPasteModalOpen(true)}
              disabled={!activeOrgId}
            >
              <RiClipboardLine className="h-4 w-4 mr-2" aria-hidden="true" />
              Open Paste Transcript Dialog
            </Button>
            <p className="text-sm text-muted-foreground mt-3">
              The paste dialog accepts plain-text transcripts. Audio/video
              uploads use the File Upload source in the sidebar.
            </p>
          </div>
        </div>
      );
    }

    return null;
  }

  /**
   * Phase 36-06 BUG-07: route an AddImportSourceDialog selection to the right flow.
   */
  function handleAddSourceSelect(choice: AddImportSourceChoice) {
    if (isWizardImportSource(choice)) {
      setSelectedSource(choice);
    } else if (choice === "youtube") {
      setSelectedSource("youtube");
    } else if (choice === "file-upload") {
      setSelectedSource("file-upload");
    } else if (choice === "paste-transcript") {
      setPasteModalOpen(true);
    }
  }

  return (
    <>
      <AppShell
        config={{
          secondaryPane: (
            <ImportSourcePane
              selectedSource={selectedSource}
              onSelectSource={setSelectedSource}
              sources={sources}
              sourcesLoading={sourcesLoading}
              onAddSource={() => setAddSourceDialogOpen(true)}
            />
          ),
          secondaryPaneTitle: "Import Sources",
          showDetailPane: true,
        }}
      >
        {renderPane3()}
      </AppShell>

      <PasteTranscriptModal
        open={pasteModalOpen}
        onOpenChange={setPasteModalOpen}
        organizationId={activeOrgId}
      />

      <AddImportSourceDialog
        open={addSourceDialogOpen}
        onOpenChange={setAddSourceDialogOpen}
        onSelect={handleAddSourceSelect}
      />
    </>
  );
}

function isWizardImportSource(
  source: ImportSourceId | AddImportSourceChoice | null,
): source is Extract<
  ConnectorSourceApp,
  "fathom" | "fireflies" | "zoom" | "plaud"
> {
  return (
    source === "fathom" ||
    source === "fireflies" ||
    source === "zoom" ||
    source === "plaud"
  );
}
