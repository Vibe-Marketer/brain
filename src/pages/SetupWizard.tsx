/**
 * SetupWizard — connector-first onboarding for new CallVault users.
 *
 * Users pick any supported recorder, connect it through the shared connector
 * setup controls, and can keep adding providers before entering the app.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import {
  RiArrowRightLine,
  RiCheckboxCircleFill,
  RiExternalLinkLine,
  RiLoader4Line,
  RiShieldCheckLine,
} from "@remixicon/react";
import { useImportSources } from "@/hooks/useImportSources";
import { Button } from "@/components/ui/button";
import { ConnectorSetupCluster } from "@/components/connectors/setup";
import { invalidateConnectorQueries } from "@/components/connectors/hooks/useConnector";
import type {
  ConnectorSourceApp,
  ConnectorStatus,
} from "@/components/connectors/registry/types";
import { tryGetSourceConfig } from "@/config/source-registry";
import {
  getOnboardingConnector,
  isOnboardingConnector,
  ONBOARDING_CONNECTORS,
} from "@/lib/onboarding-connectors";
import { cn } from "@/lib/utils";

type SelectedConnector = ConnectorSourceApp;

const WIZARD_STATE_KEY = "callvault_setup_wizard_state";

interface WizardState {
  selected: SelectedConnector | null;
  connectedSources: SelectedConnector[];
  connectedMeta?: Partial<
    Record<SelectedConnector, { sourceId?: string | null; email?: string | null }>
  >;
}

function saveWizardState(state: WizardState) {
  localStorage.setItem(WIZARD_STATE_KEY, JSON.stringify(state));
}

function loadWizardState(): WizardState | null {
  try {
    const raw = localStorage.getItem(WIZARD_STATE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as WizardState;
  } catch {
    return null;
  }
}

function clearWizardState() {
  localStorage.removeItem(WIZARD_STATE_KEY);
}

function CallVaultLogo() {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card">
        <RiShieldCheckLine className="h-5 w-5 text-vibe-orange" />
      </div>
      <div>
        <p className="text-sm font-semibold leading-none text-foreground">
          CallVault
        </p>
        <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Setup
        </p>
      </div>
    </div>
  );
}

export default function SetupWizard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const { data: importSources = [] } = useImportSources();
  const isNewUserPreview =
    import.meta.env.DEV && searchParams.get("preview") === "new-user";
  const firstConnector = ONBOARDING_CONNECTORS[0]?.metadata.sourceApp ?? null;

  const [selected, setSelected] = useState<SelectedConnector | null>(
    firstConnector,
  );
  const [connectedSources, setConnectedSources] = useState<SelectedConnector[]>(
    [],
  );
  const [connectedMeta, setConnectedMeta] = useState<
    NonNullable<WizardState["connectedMeta"]>
  >({});
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    if (isNewUserPreview) return;

    const source = searchParams.get("source");
    const connected = searchParams.get("connected") === "true";
    const sourceId = searchParams.get("sourceId");
    const email = searchParams.get("email");

    if (source && connected && isOnboardingConnector(source)) {
      const saved = loadWizardState();
      const mergedSources = addUniqueSource(
        saved?.connectedSources.filter(isOnboardingConnector) ?? connectedSources,
        source,
      );
      const mergedMeta = {
        ...(saved?.connectedMeta ?? connectedMeta),
        [source]: {
          sourceId,
          email,
        },
      };

      setSelected(source);
      setConnectedSources(mergedSources);
      setConnectedMeta(mergedMeta);
      saveWizardState({
        selected: source,
        connectedSources: mergedSources,
        connectedMeta: mergedMeta,
      });
      void invalidateConnectorQueries(queryClient, source);
      window.history.replaceState({}, "", "/setup");
      return;
    }

    const saved = loadWizardState();
    if (!saved) return;
    if (saved.selected && isOnboardingConnector(saved.selected)) {
      setSelected(saved.selected);
    }
    setConnectedSources(
      saved.connectedSources.filter(isOnboardingConnector),
    );
    setConnectedMeta(saved.connectedMeta ?? {});
  }, [isNewUserPreview, queryClient, searchParams]);

  useEffect(() => {
    saveWizardState({ selected, connectedSources, connectedMeta });
  }, [selected, connectedSources, connectedMeta]);

  useEffect(() => {
    if (isNewUserPreview) return;

    const activeOnboardingSources = importSources
      .filter((source) => source.is_active && !source.error_message)
      .map((source) => source.source_app)
      .filter(isOnboardingConnector);

    if (activeOnboardingSources.length === 0) return;

    setConnectedSources((current) =>
      activeOnboardingSources.reduce(addUniqueSource, current),
    );
    setConnectedMeta((current) => {
      const next = { ...current };
      for (const source of importSources) {
        if (!source.is_active || source.error_message) continue;
        if (!isOnboardingConnector(source.source_app)) continue;
        next[source.source_app] = {
          sourceId: source.id,
          email: source.account_email,
        };
      }
      return next;
    });
  }, [importSources, isNewUserPreview]);

  const selectedConnector = getOnboardingConnector(selected);
  const selectedLabel = selectedConnector?.metadata.label ?? "a recorder";
  const canFinish = connectedSources.length > 0;

  const handleConnected = useCallback((
    sourceApp: SelectedConnector,
    sourceId?: string | null,
  ) => {
    setConnectedSources((current) => addUniqueSource(current, sourceApp));
    setConnectedMeta((current) => ({
      ...current,
      [sourceApp]: {
        ...current[sourceApp],
        sourceId: sourceId ?? current[sourceApp]?.sourceId ?? null,
      },
    }));
  }, []);

  const handleDisconnected = useCallback((sourceApp: SelectedConnector) => {
    setConnectedSources((current) =>
      current.filter((connectedSource) => connectedSource !== sourceApp),
    );
    setConnectedMeta((current) => {
      const next = { ...current };
      delete next[sourceApp];
      return next;
    });
  }, []);

  const handleFinish = async () => {
    setFinishing(true);
    clearWizardState();
    navigate("/setup/trial", { replace: true });
  };

  const connectedLabel = useMemo(() => {
    if (connectedSources.length === 0) return "No recorders connected yet";
    return connectedSources
      .map((source) => getOnboardingConnector(source)?.metadata.label ?? source)
      .join(", ");
  }, [connectedSources]);

  const previewStatus = useMemo(
    () => (selected ? buildDisconnectedPreviewStatus(selected) : undefined),
    [selected],
  );
  const optimisticStatus = useMemo(() => {
    if (!selected || !connectedSources.includes(selected)) return undefined;
    return buildConnectedOptimisticStatus(selected, connectedMeta[selected]);
  }, [connectedMeta, connectedSources, selected]);

  return (
    <main className="min-h-screen bg-viewport p-3 md:p-4">
      <div className="mx-auto flex min-h-[calc(100vh-24px)] w-full max-w-5xl flex-col rounded-2xl border border-border/60 bg-card shadow-sm md:min-h-[calc(100vh-32px)]">
        <header className="flex flex-col gap-4 border-b border-border/60 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6">
          <CallVaultLogo />
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Setup status
              </p>
              <p className="mt-1 max-w-[320px] truncate text-xs font-medium text-foreground">
                {connectedLabel}
              </p>
            </div>
            <Button
              type="button"
              onClick={handleFinish}
              disabled={finishing}
              variant={canFinish ? "default" : "hollow"}
              className="h-10"
            >
              {finishing ? (
                <RiLoader4Line className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {canFinish ? "Continue" : "Set up later"}
              {!finishing ? <RiArrowRightLine className="ml-2 h-4 w-4" /> : null}
            </Button>
          </div>
        </header>

        <div className="grid flex-1 min-h-0 grid-cols-1 md:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="border-b border-border/60 p-4 md:border-b-0 md:border-r md:p-5">
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-foreground">
                Connect your call sources
              </h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Start with one recorder now. You can connect more accounts and providers from this screen or Settings later.
              </p>
            </div>

            <div className="mt-5 space-y-2">
              {ONBOARDING_CONNECTORS.map((adapter) => {
                const Icon = adapter.metadata.icon;
                const sourceApp = adapter.metadata.sourceApp;
                const isSelected = selected === sourceApp;
                const isConnected = connectedSources.includes(sourceApp);
                const onboardingLink = tryGetSourceConfig(sourceApp)?.onboardingLink;

                return (
                  <div
                    key={sourceApp}
                    className={cn(
                      "rounded-lg border transition-colors",
                      isSelected
                        ? "border-vibe-orange/60 bg-vibe-orange/10"
                        : "border-border/60 bg-background",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setSelected(sourceApp)}
                      className="w-full p-3 text-left hover:bg-muted/40"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-card">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-semibold text-foreground">
                              {adapter.metadata.label}
                            </p>
                            {isConnected ? (
                              <RiCheckboxCircleFill className="h-4 w-4 shrink-0 text-emerald-500" />
                            ) : null}
                          </div>
                          <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-muted-foreground">
                            {adapter.metadata.description}
                          </p>
                        </div>
                      </div>
                    </button>
                    {onboardingLink ? (
                      <a
                        href={onboardingLink.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mx-3 mb-3 inline-flex items-center gap-1 text-xs font-medium text-vibe-orange hover:underline underline-offset-2"
                      >
                        {onboardingLink.label}
                        <RiExternalLinkLine className="h-3 w-3" />
                      </a>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </aside>

          <section className="min-h-0 p-4 md:p-6">
            <motion.div
              key={selected ?? "none"}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="mx-auto flex h-full max-w-2xl flex-col"
            >
              <div className="mb-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-vibe-orange">
                  Selected source
                </p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
                  Connect {selectedLabel}
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Follow the setup controls below. OAuth providers open their authorization screen and return here when complete.
                </p>
              </div>

              {selected ? (
                <ConnectorSetupCluster
                  sourceApp={selected}
                  mode="onboarding"
                  returnTo="/setup"
                  onConnected={(sourceId) => handleConnected(selected, sourceId)}
                  onSaved={(sourceId) => handleConnected(selected, sourceId)}
                  onDisconnected={() => handleDisconnected(selected)}
                  statusOverride={
                    isNewUserPreview
                      ? previewStatus
                      : optimisticStatus
                  }
                  className="w-full"
                />
              ) : (
                <div className="rounded-lg border border-border bg-muted/20 p-5 text-sm text-muted-foreground">
                  Select a provider to start setup.
                </div>
              )}

              <div className="mt-auto flex flex-col gap-2 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  Historical calls are selected and imported manually. Future calls can sync automatically where webhooks are configured.
                </p>
                <Button
                  type="button"
                  onClick={handleFinish}
                  disabled={finishing}
                  variant={canFinish ? "default" : "hollow"}
                  className="shrink-0"
                >
                  {canFinish ? "Continue" : "Skip for now"}
                </Button>
              </div>
            </motion.div>
          </section>
        </div>
      </div>
    </main>
  );
}

function buildDisconnectedPreviewStatus(
  sourceApp: SelectedConnector,
): ConnectorStatus {
  return {
    sourceApp,
    sourceId: null,
    connected: false,
    hasEverConnected: false,
    accountEmail: null,
    lastSyncAt: null,
    tokenExpiresMs: null,
    errorMessage: null,
    tokenExpired: false,
    allRows: [],
  };
}

function buildConnectedOptimisticStatus(
  sourceApp: SelectedConnector,
  meta?: { sourceId?: string | null; email?: string | null },
): ConnectorStatus {
  return {
    sourceApp,
    sourceId: meta?.sourceId ?? null,
    connected: true,
    hasEverConnected: true,
    accountEmail: meta?.email ?? null,
    lastSyncAt: null,
    tokenExpiresMs: null,
    errorMessage: null,
    tokenExpired: false,
    allRows: [],
  };
}

function addUniqueSource(
  current: SelectedConnector[],
  source: SelectedConnector,
): SelectedConnector[] {
  return current.includes(source) ? current : [...current, source];
}
