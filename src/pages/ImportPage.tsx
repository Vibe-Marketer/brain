import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-config";
import { toast } from "sonner";
import {
  RiYoutubeLine,
  RiDownloadCloud2Line,
} from "@remixicon/react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { usePanelStore } from "@/stores/panelStore";
import { useOrgContext } from "@/hooks/useOrgContext";
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
import { invalidateConnectorQueries } from "@/components/connectors/hooks/useConnector";
import { getConnectorSyncFunctionName } from "@/lib/connector-sync-functions";
import {
  getImportSourceFlow,
  isConnectorWizardImportSource,
  isSelectableImportSource,
} from "@/lib/import-source-flow";
import { tryGetSourceConfig } from "@/config/source-registry";
import {
  useImportSources,
  useImportCounts,
  useFailedImports,
} from "@/hooks/useImportSources";
import { upsertImportSource } from "@/services/import-sources.service";
import { PageHeader } from "@/components/ui/page-header";

export default function ImportPage() {
  const queryClient = useQueryClient();
  const [selectedSource, setSelectedSource] = useState<ImportSourceId | null>(
    "paste-transcript",
  );
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

    if (!connectedSource) return;

    window.history.replaceState({}, "", window.location.pathname);

    if (!wasConnected) {
      if (isSelectableImportSource(connectedSource)) {
        setSelectedSource(connectedSource);
      }
      return;
    }

    async function handleOAuthReturn() {
      if (!connectedSource) return;
      try {
        if (isSelectableImportSource(connectedSource)) {
          setSelectedSource(connectedSource);
        }
        await upsertImportSource({
          source_app: connectedSource,
          account_email: accountEmail,
          source_id: sourceId,
        });
        toast.success(`Connected ${connectedSource}! Syncing your calls…`);
        if (isConnectorWizardImportSource(connectedSource)) {
          await invalidateConnectorQueries(queryClient, connectedSource);
        } else {
          await queryClient.invalidateQueries({
            queryKey: queryKeys.imports.sources(),
          });
        }

        const fnName = getConnectorSyncFunctionName(connectedSource);
        if (fnName) {
          const { data } = await supabase.functions.invoke(fnName, {
            body: sourceId ? { sourceId } : undefined,
          });
          const synced =
            (data as { synced_count?: number } | null)?.synced_count ?? 0;
          const sourceName =
            tryGetSourceConfig(connectedSource)?.label ?? connectedSource;
          if (synced > 0) {
            toast.success(
              `${sourceName} sync complete — ${synced} new calls imported`,
            );
          }
        }
        await queryClient.invalidateQueries({
          queryKey: queryKeys.imports.counts(),
        });
      } catch (err) {
        toast.error(
          `Sync failed: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      }
    }

    void handleOAuthReturn();
  }, [queryClient]);

  // Pane 3 content based on selected source
  function renderPane3() {
    if (!selectedSource) {
      return (
        <div className="relative h-full">
          <ImportOverviewDashboard
            counts={counts}
            failedImports={failedImports}
            onSelectSource={(id) => setSelectedSource(id as ImportSourceId)}
          />
        </div>
      );
    }

    const sourceFlow = getImportSourceFlow(selectedSource);

    if (isConnectorWizardImportSource(selectedSource)) {
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

    if (sourceFlow === "public-url") {
      return (
        <div className="flex flex-col h-full overflow-hidden">
          <PageHeader
            title="YouTube"
            subtitle="Import calls from YouTube URLs"
            icon={RiYoutubeLine}
          />
          <div className="flex-1 overflow-y-auto px-6 py-6">
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

    if (sourceFlow === "routing-rules") {
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

    if (sourceFlow === "import-history") {
      // Phase 36-06 BUG-06: real Import History panel (not just failed imports)
      return <ImportHistoryPanel />;
    }

    if (sourceFlow === "paste-transcript") {
      return (
        <div className="flex flex-col h-full overflow-hidden">
          <PageHeader
            title="Import Transcript"
            subtitle="Paste transcript text, source links, or transcript files"
            icon={RiDownloadCloud2Line}
          />
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <PasteTranscriptModal
              open={true}
              onOpenChange={() => {}}
              organizationId={activeOrgId}
              inline
              showInlineHeader={false}
            />
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
    const sourceFlow = getImportSourceFlow(choice);
    if (sourceFlow === "paste-transcript") {
      setSelectedSource(choice);
    } else if (sourceFlow !== "unknown") {
      setSelectedSource(choice);
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

      <AddImportSourceDialog
        open={addSourceDialogOpen}
        onOpenChange={setAddSourceDialogOpen}
        onSelect={handleAddSourceSelect}
      />
    </>
  );
}
