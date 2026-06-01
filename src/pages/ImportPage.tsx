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
import { ManualImportSourceCard } from "@/components/import/ManualImportSourceCard";
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
import { OnboardingVideoModal } from "@/components/onboarding/OnboardingVideoModal";
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

const FIRST_RUN_CONTEXT_KEY = "callvault_import_first_run_context";
const ONBOARDING_VIDEO_SEEN_KEY = "callvault_onboarding_video_seen";

interface FirstRunImportContext {
  source?: string | null;
  sourceId?: string | null;
  email?: string | null;
}

function readFirstRunContext(): FirstRunImportContext | null {
  try {
    const raw = localStorage.getItem(FIRST_RUN_CONTEXT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as FirstRunImportContext;
  } catch {
    return null;
  }
}

export default function ImportPage() {
  const queryClient = useQueryClient();
  const [selectedSource, setSelectedSource] = useState<ImportSourceId | null>(
    "paste-transcript",
  );
  const [onboardingVideoOpen, setOnboardingVideoOpen] = useState(false);
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
    const storedContext = readFirstRunContext();
    const connectedSource = params.get("source") ?? storedContext?.source ?? null;
    const accountEmail = params.get("email") ?? storedContext?.email ?? undefined;
    const sourceId = params.get("sourceId") ?? storedContext?.sourceId ?? undefined;
    const firstRunVideo = params.get("firstRunVideo");
    const shouldShowFirstRunVideo = firstRunVideo === "true" || firstRunVideo === "1";

    if (!connectedSource && !shouldShowFirstRunVideo) return;

    const nextSearch = new URLSearchParams(params);
    for (const consumedKey of ["source", "sourceId", "email", "connected", "firstRunVideo"]) {
      nextSearch.delete(consumedKey);
    }
    const nextQuery = nextSearch.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash}`;
    window.history.replaceState({}, "", nextUrl);

    if (
      shouldShowFirstRunVideo &&
      localStorage.getItem(ONBOARDING_VIDEO_SEEN_KEY) !== "true"
    ) {
      setOnboardingVideoOpen(true);
    }
    if (connectedSource && isSelectableImportSource(connectedSource)) {
      setSelectedSource(connectedSource);
    }
    if (!connectedSource) return;

    async function handleOAuthReturn() {
      try {
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
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <ManualImportSourceCard
              label="YouTube"
              description="YouTube imports are available without account setup."
              icon={RiYoutubeLine}
            >
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
            </ManualImportSourceCard>
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
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <ManualImportSourceCard
              label="Import Transcript"
              description="Paste transcript text, source links, or transcript files."
              icon={RiDownloadCloud2Line}
            >
              <PasteTranscriptModal
                open={true}
                onOpenChange={() => {}}
                organizationId={activeOrgId}
                inline
                showInlineHeader={false}
              />
            </ManualImportSourceCard>
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

      <OnboardingVideoModal
        open={onboardingVideoOpen}
        onOpenChange={(open) => {
          if (!open) {
            localStorage.setItem(ONBOARDING_VIDEO_SEEN_KEY, "true");
          }
          setOnboardingVideoOpen(open);
        }}
        onStartSyncing={() => {
          localStorage.setItem(ONBOARDING_VIDEO_SEEN_KEY, "true");
          setOnboardingVideoOpen(false);
        }}
      />
    </>
  );
}
