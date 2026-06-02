import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  RiArrowRightLine,
  RiCheckboxCircleFill,
  RiFlashlightLine,
  RiLoader4Line,
  RiShieldCheckLine,
  RiTeamLine,
} from "@remixicon/react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UpgradeButton } from "@/components/billing/UpgradeButton";
import { TrialCountdownBadge } from "@/components/billing/TrialCountdownBadge";
import { useImportSources } from "@/hooks/useImportSources";
import { useOnboarding } from "@/hooks/useOnboarding";
import { POLAR_PRODUCT_IDS, useSubscription } from "@/hooks/useSubscription";
import { getOnboardingConnector, isOnboardingConnector } from "@/lib/onboarding-connectors";
import { formatTrialEndDate, getTrialDaysRemaining, isActiveProTrial } from "@/lib/trial";

const EXIT_MODAL_KEY = "callvault_trial_exit_modal_seen";
const SETUP_WIZARD_STATE_KEY = "callvault_setup_wizard_state";
const FIRST_RUN_CONTEXT_KEY = "callvault_import_first_run_context";

interface SetupWizardState {
  selected?: string | null;
  connectedMeta?: Record<string, { sourceId?: string | null; email?: string | null }>;
}

function readSetupWizardState(): SetupWizardState | null {
  try {
    const raw = localStorage.getItem(SETUP_WIZARD_STATE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SetupWizardState;
  } catch {
    return null;
  }
}

function buildImportEntryPath(params: {
  source?: string | null;
  sourceId?: string | null;
  email?: string | null;
}): string {
  const query = new URLSearchParams();
  if (params.source) query.set("source", params.source);
  if (params.sourceId) query.set("sourceId", params.sourceId);
  if (params.email) query.set("email", params.email);
  query.set("firstRunVideo", "true");
  const serialized = query.toString();
  return serialized ? `/import?${serialized}` : "/import";
}

export default function SetupTrialUpsell() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { completeOnboarding } = useOnboarding();
  const { data: importSources = [] } = useImportSources();
  const { isLoading, productId, status, periodEnd, tier } = useSubscription();
  const [finishing, setFinishing] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const isTrialPreview = import.meta.env.DEV && searchParams.get("preview") === "trial";

  const effectiveProductId = isTrialPreview ? "pro-trial" : productId;
  const effectiveStatus = isTrialPreview ? "trialing" : status;
  const effectivePeriodEnd = isTrialPreview
    ? new Date(Date.now() + 6 * 24 * 60 * 60 * 1000)
    : periodEnd;
  const effectiveTier = isTrialPreview ? "pro" : tier;

  const activeTrial = isActiveProTrial(
    effectiveProductId,
    effectiveStatus,
    effectivePeriodEnd,
  );
  const paidPlanActive = effectiveTier !== "free" && !activeTrial;
  const daysRemaining = getTrialDaysRemaining(effectivePeriodEnd);
  const connectedSources = useMemo(
    () =>
      importSources
        .filter((source) => source.is_active && !source.error_message)
        .map((source) => source.source_app)
        .filter(isOnboardingConnector),
    [importSources],
  );

  const connectedLabels = connectedSources.map(
    (source) => getOnboardingConnector(source)?.metadata.label ?? source,
  );
  const mostRecentConnected = useMemo(() => {
    const activeConnected = importSources
      .filter((source) => source.is_active && !source.error_message)
      .filter((source) => isOnboardingConnector(source.source_app))
      .sort(
        (a, b) =>
          new Date(b.updated_at ?? b.created_at).getTime() -
          new Date(a.updated_at ?? a.created_at).getTime(),
      )[0];

    if (activeConnected) {
      return {
        source: activeConnected.source_app,
        sourceId: activeConnected.id,
        email: activeConnected.account_email,
      };
    }

    const wizardState = readSetupWizardState();
    const selectedSource = wizardState?.selected;
    if (selectedSource && isOnboardingConnector(selectedSource)) {
      const selectedMeta = wizardState?.connectedMeta?.[selectedSource];
      return {
        source: selectedSource,
        sourceId: selectedMeta?.sourceId ?? null,
        email: selectedMeta?.email ?? null,
      };
    }

    return null;
  }, [importSources]);
  const importEntryPath = useMemo(
    () =>
      buildImportEntryPath({
        source: mostRecentConnected?.source,
        sourceId: mostRecentConnected?.sourceId,
        email: mostRecentConnected?.email,
      }),
    [mostRecentConnected],
  );

  useEffect(() => {
    const handleMouseLeave = (event: MouseEvent) => {
      if (event.clientY > 12) return;
      if (sessionStorage.getItem(EXIT_MODAL_KEY) === "true") return;
      sessionStorage.setItem(EXIT_MODAL_KEY, "true");
      setExitOpen(true);
    };

    document.addEventListener("mouseleave", handleMouseLeave);
    return () => document.removeEventListener("mouseleave", handleMouseLeave);
  }, []);

  useEffect(() => {
    if (!mostRecentConnected) return;
    localStorage.setItem(FIRST_RUN_CONTEXT_KEY, JSON.stringify(mostRecentConnected));
  }, [mostRecentConnected]);

  const enterApp = useCallback(async () => {
    setFinishing(true);
    await completeOnboarding();
    navigate(importEntryPath, { replace: true });
  }, [completeOnboarding, importEntryPath, navigate]);

  const handleCheckoutStarted = useCallback(async () => {
    await completeOnboarding();
    if (mostRecentConnected) {
      localStorage.setItem(FIRST_RUN_CONTEXT_KEY, JSON.stringify(mostRecentConnected));
    }
  }, [completeOnboarding, mostRecentConnected]);

  const trialCopy = activeTrial
    ? daysRemaining == null
      ? "Your Pro trial is active."
      : `${daysRemaining} day${daysRemaining === 1 ? "" : "s"} left in your Pro trial.`
    : effectiveTier === "free"
      ? "Start Pro when you are ready."
      : "Your paid plan is active.";
  const supportingCopy = activeTrial
    ? "Add payment details now so imports, workspaces, and MCP access continue without interruption when the trial ends."
    : effectiveTier === "free"
      ? "Start Pro to unlock the full import workflow, multiple workspaces, and external AI access."
      : "You already have paid access. You can continue into CallVault or review sources before entering the app.";

  return (
    <main className="min-h-screen bg-viewport p-3 md:p-4">
      <div className="mx-auto flex min-h-[calc(100vh-24px)] w-full max-w-5xl flex-col rounded-2xl border border-border/60 bg-card shadow-sm md:min-h-[calc(100vh-32px)]">
        <header className="flex flex-col gap-4 border-b border-border/60 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card">
              <RiShieldCheckLine className="h-5 w-5 text-vibe-orange" />
            </div>
            <div>
              <p className="text-sm font-semibold leading-none text-foreground">CallVault</p>
              <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Pro trial
              </p>
            </div>
          </div>
          <Button type="button" variant="hollow" onClick={() => navigate("/setup")}>
            Back to sources
          </Button>
        </header>

        <div className="grid flex-1 grid-cols-1 gap-0 md:grid-cols-[minmax(0,1fr)_360px]">
          <section className="p-5 md:p-8">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="max-w-2xl"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-vibe-orange">
                Final step
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
                {paidPlanActive ? "You're all set" : "Keep Pro ready when your trial ends"}
              </h1>
              <p className="mt-4 text-sm leading-6 text-muted-foreground">
                {trialCopy} {supportingCopy}
              </p>

              <div className="mt-6 rounded-xl border border-border/60 bg-muted/20 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-vibe-orange/25 bg-vibe-orange/10">
                    <RiFlashlightLine className="h-5 w-5 text-vibe-orange" />
                  </div>
                  <div>
                <h2 className="text-sm font-semibold text-foreground">
                      {isLoading
                        ? "Checking trial status..."
                        : paidPlanActive
                          ? "Your paid plan is active"
                          : activeTrial
                            ? "Your Pro trial is active"
                            : "Pro unlocks the full workflow"}
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {paidPlanActive
                        ? "Enter CallVault now, or go back if you want to connect another source first."
                        : activeTrial
                        ? `Trial access ends ${formatTrialEndDate(effectivePeriodEnd)}. Add payment details to keep unlimited imports, workspaces, and external AI access active after that date.`
                        : "Start checkout when you want unlimited imports, multiple workspaces, MCP/external AI access, and higher AI action limits."}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {[
                  "Unlimited imports",
                  "Multiple workspaces",
                  "MCP and external AI access",
                ].map((feature) => (
                  <div key={feature} className="rounded-lg border border-border/60 bg-background p-3">
                    <RiCheckboxCircleFill className="h-4 w-4 text-emerald-500" />
                    <p className="mt-2 text-sm font-medium text-foreground">{feature}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-xl border border-border/60 bg-background p-4">
                <h2 className="text-sm font-semibold text-foreground">Connected sources</h2>
                {connectedLabels.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {connectedLabels.map((label) => (
                      <span
                        key={label}
                        className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/30 px-2.5 py-1 text-xs font-medium text-foreground"
                      >
                        <RiCheckboxCircleFill className="h-3.5 w-3.5 text-emerald-500" />
                        {label}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">
                    You can connect sources now or continue and add them from Import later.
                  </p>
                )}
                <p className="mt-3 text-xs leading-5 text-muted-foreground">
                  Historical calls stay manual: you choose what to import. Future calls sync
                  automatically where the connected source supports it.
                </p>
              </div>
            </motion.div>
          </section>

          <aside className="border-t border-border/60 bg-muted/20 p-5 md:border-l md:border-t-0 md:p-6">
            <div className="rounded-xl border border-border/70 bg-card p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">Pro</p>
                  <p className="text-xs text-muted-foreground">Best for active call workflows</p>
                </div>
                <div className="rounded-full border border-vibe-orange/25 bg-vibe-orange/10 px-2.5 py-1 text-xs font-semibold text-foreground">
                  {activeTrial ? "Trial active" : effectiveTier === "free" ? "Optional" : "Active"}
                </div>
              </div>

              <div className="mt-5">
                <p className="text-3xl font-semibold tracking-tight text-foreground">
                  {paidPlanActive ? "Active" : "$0 today"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {paidPlanActive
                    ? "Your Pro access is already active."
                    : "Then $29/month after the trial unless canceled."}
                </p>
              </div>

              <div className="mt-5 space-y-3 border-y border-border/60 py-4">
                {paidPlanActive ? (
                  <>
                    <TimelineItem title="Now" copy="Use Pro across imports, workspaces, and AI access." />
                    <TimelineItem title="Next" copy="Import selected historical calls or let future calls sync where supported." />
                  </>
                ) : (
                  <>
                    <TimelineItem title="Today" copy="Use Pro during your trial." />
                    <TimelineItem title="Before it ends" copy="We keep the trial countdown visible in the app." />
                    <TimelineItem title="Trial end" copy="Your Pro subscription starts automatically unless canceled." />
                  </>
                )}
              </div>

              {paidPlanActive ? (
                <Button type="button" onClick={enterApp} disabled={finishing} className="mt-5 w-full">
                  {finishing ? <RiLoader4Line className="h-4 w-4 animate-spin" /> : null}
                  Enter CallVault
                </Button>
              ) : (
                <>
                  <UpgradeButton
                    productId={POLAR_PRODUCT_IDS.PRO_MONTHLY}
                    successPath={importEntryPath}
                    onCheckoutStarted={handleCheckoutStarted}
                    className="mt-5 w-full"
                  >
                    Add payment details
                    <RiArrowRightLine className="h-4 w-4" />
                  </UpgradeButton>
                </>
              )}
            </div>

            <div className="mt-4 rounded-xl border border-border/60 bg-background p-4">
              <div className="flex items-start gap-3">
                <RiTeamLine className="mt-0.5 h-4 w-4 text-vibe-orange" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Using CallVault with a team?</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Team includes shared workspaces, admin controls, and pooled AI actions for
                    multi-person call workflows.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => setTeamOpen(true)}
                  >
                    View Team plan
                  </Button>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      <Dialog open={exitOpen} onOpenChange={setExitOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Continue without a credit card?</DialogTitle>
            <DialogDescription>
              You can use CallVault without adding payment details. Your Pro trial stays active
              until it ends, then your account automatically continues on Free.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-sm text-muted-foreground">
            Free includes core organization tools and limited monthly imports. You can upgrade
            from Billing whenever you are ready.
          </div>
          <DialogFooter>
            <Button type="button" variant="hollow" onClick={enterApp} disabled={finishing}>
              {finishing ? <RiLoader4Line className="h-4 w-4 animate-spin" /> : null}
              Continue without card
            </Button>
            <UpgradeButton
              productId={POLAR_PRODUCT_IDS.PRO_MONTHLY}
              successPath={importEntryPath}
              onCheckoutStarted={handleCheckoutStarted}
            >
              Add payment details
            </UpgradeButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={teamOpen} onOpenChange={setTeamOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Set up CallVault with your team?</DialogTitle>
            <DialogDescription>
              Start Team checkout for shared workspaces, admin controls, and pooled usage.
              You can invite teammates after payment is active.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="hollow" onClick={() => setTeamOpen(false)}>
              Stay here
            </Button>
            <UpgradeButton
              productId={POLAR_PRODUCT_IDS.TEAM_MONTHLY}
              successPath={importEntryPath}
              onCheckoutStarted={handleCheckoutStarted}
            >
              Start Team checkout
            </UpgradeButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TrialCountdownBadge />
    </main>
  );
}

function TimelineItem({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="flex gap-3">
      <div className="mt-1 h-2 w-2 rounded-full bg-vibe-orange" />
      <div>
        <p className="text-xs font-semibold text-foreground">{title}</p>
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{copy}</p>
      </div>
    </div>
  );
}
