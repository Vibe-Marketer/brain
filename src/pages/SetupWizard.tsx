/**
 * SetupWizard — Full-page onboarding wizard for new CallVault users.
 *
 * 3-step flow:
 *   Step 1 — Choose your recorder (Fathom or Zoom)
 *   Step 2 — Connect the selected recorder via OAuth
 *   Step 3 — Sync calls and show progress
 *
 * This page is NOT inside Layout/AppShell — it IS the full page.
 * Users cannot access the app until they complete this wizard.
 *
 * OAuth flow persistence: wizard state is saved to localStorage so
 * the user returns to the correct step after the OAuth redirect.
 *
 * @pattern full-page-wizard
 */

import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import {
  RiRobot2Line,
  RiVideoChatLine,
  RiArrowLeftLine,
  RiArrowRightLine,
  RiCheckLine,
  RiLoader4Line,
  RiExternalLinkLine,
  RiShieldCheckLine,
} from "@remixicon/react";
import { supabase } from "@/integrations/supabase/client";
import { useOnboarding } from "@/hooks/useOnboarding";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type RecorderType = "fathom" | "zoom";
type WizardStep = 1 | 2 | 3;

const WIZARD_STATE_KEY = "callvault_setup_wizard_state";

interface WizardState {
  step: WizardStep;
  recorder: RecorderType | null;
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

/* ─────────────────────────── Progress Dots ─────────────────────────── */

function ProgressDots({ currentStep }: { currentStep: WizardStep }) {
  return (
    <div className="flex items-center justify-center gap-2 mt-8">
      {[1, 2, 3].map((step) => (
        <motion.div
          key={step}
          animate={{
            width: step === currentStep ? 24 : 8,
            backgroundColor:
              step === currentStep
                ? "hsl(var(--vibe-orange))"
                : step < currentStep
                  ? "hsl(var(--vibe-orange) / 0.4)"
                  : "hsl(var(--muted-foreground) / 0.25)",
          }}
          transition={{ duration: 0.25, ease: "easeInOut" }}
          className="h-2 rounded-full"
        />
      ))}
      <span className="ml-3 text-xs text-muted-foreground">
        Step {currentStep} of 3
      </span>
    </div>
  );
}

/* ─────────────────────────── Recorder Card ─────────────────────────── */

interface RecorderCardProps {
  icon: React.ReactNode;
  name: string;
  subtitle: string;
  recommended?: boolean;
  selected: boolean;
  onClick: () => void;
  children?: React.ReactNode;
}

function RecorderCard({
  icon,
  name,
  subtitle,
  recommended,
  selected,
  onClick,
  children,
}: RecorderCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left p-5 rounded-xl border-2 transition-all duration-200",
        "hover:border-vibe-orange/40 hover:bg-muted/40",
        selected
          ? "border-vibe-orange bg-vibe-orange/5 shadow-sm"
          : "border-border bg-card"
      )}
    >
      <div className="flex items-start gap-4">
        <div
          className={cn(
            "shrink-0 h-12 w-12 rounded-xl flex items-center justify-center transition-colors",
            selected ? "bg-vibe-orange/20" : "bg-vibe-orange/10"
          )}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold text-foreground">
              {name}
            </span>
            {recommended && (
              <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide rounded-full bg-vibe-orange/15 text-vibe-orange">
                Recommended
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
          {children}
        </div>
        {selected && (
          <div className="shrink-0 h-6 w-6 rounded-full bg-vibe-orange flex items-center justify-center">
            <RiCheckLine className="h-4 w-4 text-white" />
          </div>
        )}
      </div>
    </button>
  );
}

/* ─────────────────────────── Logo ─────────────────────────── */

function CallVaultLogo() {
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-sm">
        <RiShieldCheckLine className="h-5 w-5 text-white" />
      </div>
      <span className="text-xl font-bold tracking-tight text-foreground">
        CallVault
      </span>
    </div>
  );
}

/* ─────────────────────────── Primary CTA Button ─────────────────────────── */

function PrimaryButton({
  onClick,
  disabled,
  children,
  className,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full h-12 rounded-xl text-base font-semibold text-white",
        "bg-gradient-to-b from-orange-400 to-orange-600",
        "border border-orange-600/70",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_1px_4px_rgba(255,136,0,0.3)]",
        "hover:from-orange-500 hover:to-orange-700",
        "active:translate-y-px active:scale-[0.98]",
        "transition-all duration-150",
        "disabled:opacity-50 disabled:cursor-not-allowed disabled:active:translate-y-0 disabled:active:scale-100",
        "flex items-center justify-center gap-2",
        className
      )}
    >
      {children}
    </button>
  );
}

/* ─────────────────────────── OAuth Functions ─────────────────────────── */

async function connectFathom() {
  const { data, error } = await supabase.functions.invoke("fathom-oauth-url");
  if (error || !data?.authUrl) {
    toast.error("Failed to start Fathom connection");
    return;
  }
  window.open(data.authUrl as string, '_blank', 'noopener,noreferrer');
}

async function connectZoom() {
  const { data, error } = await supabase.functions.invoke("zoom-oauth-url");
  if (error || !data?.authUrl) {
    toast.error("Failed to start Zoom connection");
    return;
  }
  window.open(data.authUrl as string, '_blank', 'noopener,noreferrer');
}

/* ═══════════════════════════ Main Component ═══════════════════════════ */

export default function SetupWizard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { completeOnboarding } = useOnboarding();

  const [step, setStep] = useState<WizardStep>(1);
  const [recorder, setRecorder] = useState<RecorderType | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [syncDone, setSyncDone] = useState(false);

  // Restore wizard state after OAuth redirect
  useEffect(() => {
    const source = searchParams.get("source");
    const connected = searchParams.get("connected") === "true";

    if (source && connected) {
      // Returned from OAuth — jump to sync step
      const recorderType = source as RecorderType;
      setRecorder(recorderType);
      setStep(3);
      clearWizardState();
      // Clean URL
      window.history.replaceState({}, "", "/setup");
      return;
    }

    // Check localStorage for saved state
    const saved = loadWizardState();
    if (saved) {
      if (saved.recorder) setRecorder(saved.recorder);
      if (saved.step) setStep(saved.step);
    }
  }, [searchParams]);

  // When entering step 3 (after OAuth), mark as done immediately.
  // The actual import happens from the Import page where the user picks dates/calls.
  useEffect(() => {
    if (step !== 3 || !recorder || syncDone) return;
    setSyncDone(true);
  }, [step, recorder, syncDone]);

  const handleSelectRecorder = (type: RecorderType) => {
    setRecorder(type);
  };

  const goToStep = useCallback(
    (newStep: WizardStep) => {
      setStep(newStep);
      if (recorder) {
        saveWizardState({ step: newStep, recorder });
      }
    },
    [recorder]
  );

  const handleConnect = async () => {
    if (!recorder) return;
    setConnecting(true);

    // Save state before OAuth redirect
    saveWizardState({ step: 2, recorder });

    try {
      if (recorder === "fathom") {
        await connectFathom();
      } else {
        await connectZoom();
      }
    } catch {
      setConnecting(false);
      toast.error("Failed to start connection. Please try again.");
    }
  };

  const handleFinish = async () => {
    clearWizardState();
    await completeOnboarding();
    navigate("/", { replace: true });
  };

  const recorderLabel = recorder === "fathom" ? "Fathom" : "Zoom";

  /* ── Step 1: Choose Your Recorder ── */
  const step1 = (
    <motion.div
      key="step-1"
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.25, ease: "easeInOut" }}
      className="flex flex-col"
    >
      <h1 className="text-2xl font-bold tracking-tight text-foreground text-center">
        Let's get your calls into CallVault
      </h1>
      <p className="mt-2 text-sm text-muted-foreground text-center max-w-sm mx-auto">
        Connect your call recorder to automatically import and organize your
        meetings.
      </p>

      <div className="mt-8 space-y-3">
        <RecorderCard
          icon={<RiRobot2Line className="h-6 w-6 text-vibe-orange" />}
          name="Fathom"
          subtitle="AI meeting recorder"
          recommended
          selected={recorder === "fathom"}
          onClick={() => handleSelectRecorder("fathom")}
        >
          <a
            href="https://fathom.video/invite/VibeOS"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 mt-2 text-xs text-vibe-orange hover:underline underline-offset-2"
          >
            Don't have Fathom? Get it free
            <RiExternalLinkLine className="h-3 w-3" />
          </a>
        </RecorderCard>

        <div className="relative">
          <RecorderCard
            icon={<RiVideoChatLine className="h-6 w-6 text-muted-foreground/40" />}
            name="Zoom"
            subtitle="Video conferencing"
            selected={false}
            onClick={() => {}}
          />
          <div className="absolute inset-0 rounded-xl bg-card/60 cursor-not-allowed" />
          <span className="absolute top-3 right-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            Coming Soon
          </span>
        </div>
      </div>

      <PrimaryButton
        onClick={() => goToStep(2)}
        disabled={!recorder}
        className="mt-8"
      >
        Continue
        <RiArrowRightLine className="h-4 w-4" />
      </PrimaryButton>
    </motion.div>
  );

  /* ── Step 2: Connect ── */
  const step2 = (
    <motion.div
      key="step-2"
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.25, ease: "easeInOut" }}
      className="flex flex-col items-center text-center"
    >
      <div className="h-16 w-16 rounded-2xl bg-vibe-orange/15 border border-vibe-orange/30 flex items-center justify-center mb-6">
        {recorder === "fathom" ? (
          <RiRobot2Line className="h-8 w-8 text-vibe-orange" />
        ) : (
          <RiVideoChatLine className="h-8 w-8 text-vibe-orange" />
        )}
      </div>

      <h1 className="text-2xl font-bold tracking-tight text-foreground">
        Connect your {recorderLabel} account
      </h1>
      <p className="mt-2 text-sm text-muted-foreground max-w-sm">
        You'll be redirected to {recorderLabel} to authorize access. CallVault
        will import your call recordings and transcripts.
      </p>

      <PrimaryButton
        onClick={handleConnect}
        disabled={connecting}
        className="mt-8"
      >
        {connecting ? (
          <>
            <RiLoader4Line className="h-5 w-5 animate-spin" />
            Connecting...
          </>
        ) : (
          <>Authorize with {recorderLabel}</>
        )}
      </PrimaryButton>

      <button
        type="button"
        onClick={() => {
          setSyncDone(false);
          goToStep(1);
        }}
        className="mt-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <RiArrowLeftLine className="h-4 w-4" />
        Back
      </button>
    </motion.div>
  );

  /* ── Step 3: Connected ── */
  const step3 = (
    <motion.div
      key="step-3"
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.25, ease: "easeInOut" }}
      className="flex flex-col items-center text-center"
    >
      {syncDone ? (
        <>
          <div className="relative flex items-center justify-center mb-6">
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="absolute h-24 w-24 rounded-full bg-vibe-orange/10"
            />
            <motion.div
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{
                duration: 0.35,
                delay: 0.05,
                ease: [0.34, 1.56, 0.64, 1],
              }}
              className="relative h-16 w-16 rounded-full bg-vibe-orange/15 flex items-center justify-center border-2 border-vibe-orange/40"
            >
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{
                  duration: 0.3,
                  delay: 0.25,
                  ease: [0.34, 1.56, 0.64, 1],
                }}
              >
                <RiCheckLine className="h-8 w-8 text-vibe-orange" />
              </motion.div>
            </motion.div>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            All set! You're connected
          </h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-sm">
            Your {recorderLabel} account is linked. Head to Import to pull in your calls.
          </p>

          <PrimaryButton onClick={handleFinish} className="mt-8">
            Go to your calls
            <RiArrowRightLine className="h-4 w-4" />
          </PrimaryButton>
        </>
      ) : (
        // Brief loading while state settles
        <div className="flex items-center justify-center h-32">
          <RiLoader4Line className="h-8 w-8 text-vibe-orange animate-spin" />
        </div>
      )}
    </motion.div>
  );

  const steps: Record<WizardStep, React.ReactNode> = {
    1: step1,
    2: step2,
    3: step3,
  };

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-4"
      style={{
        background:
          "linear-gradient(135deg, rgba(255, 235, 0, 0.12) 0%, rgba(255, 136, 0, 0.08) 50%, rgba(255, 61, 0, 0.05) 100%), hsl(var(--viewport))",
      }}
    >
      <div className="w-full max-w-md">
        <div className="bg-card rounded-2xl border border-border shadow-lg p-8">
          <CallVaultLogo />

          <AnimatePresence mode="wait">{steps[step]}</AnimatePresence>

          <ProgressDots currentStep={step} />
        </div>
      </div>
    </div>
  );
}
