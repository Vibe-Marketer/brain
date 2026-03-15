/**
 * OnboardingModal — First-run wizard for new CallVault users.
 *
 * 3-step flow:
 *   Step 0 — Welcome (value prop + feature bullets)
 *   Step 1 — Connect your first source
 *   Step 2 — You're all set (tips + CTA)
 *
 * Completion marks user_profiles.onboarding_completed = true via useOnboarding().
 *
 * @pattern dialog-wizard
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  RiRecordCircleLine,
  RiSearchLine,
  RiFolderLine,
  RiBarChartLine,
  RiRobot2Line,
  RiVideoChatLine,
  RiUpload2Line,
  RiKeyboardLine,
  RiFolderAddLine,
  RiRuler2Line,
  RiArrowRightLine,
  RiCheckLine,
} from "@remixicon/react";
import { cn } from "@/lib/utils";

interface OnboardingModalProps {
  open: boolean;
  onComplete: () => Promise<void>;
  onOpenChange?: (open: boolean) => void;
}

const TOTAL_STEPS = 3;

/* ─────────────────────────── Step dot indicator ─────────────────────────── */

function StepDots({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-center gap-2 pt-2 pb-1">
      {Array.from({ length: TOTAL_STEPS }, (_, i) => (
        <motion.div
          key={i}
          animate={{
            width: i === currentStep ? 20 : 6,
            backgroundColor:
              i === currentStep
                ? "hsl(var(--vibe-orange))"
                : i < currentStep
                  ? "hsl(var(--vibe-orange) / 0.4)"
                  : "hsl(var(--muted-foreground) / 0.25)",
          }}
          transition={{ duration: 0.25, ease: "easeInOut" }}
          className="h-1.5 rounded-full"
        />
      ))}
    </div>
  );
}

/* ──────────────────────────── Animated checkmark ────────────────────────── */

function AnimatedCheck() {
  return (
    <div className="relative flex items-center justify-center">
      {/* Glow ring */}
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="absolute h-24 w-24 rounded-full bg-vibe-orange/10"
      />
      {/* Circle */}
      <motion.div
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.35, delay: 0.05, ease: [0.34, 1.56, 0.64, 1] }}
        className="relative h-16 w-16 rounded-full bg-vibe-orange/15 flex items-center justify-center border-2 border-vibe-orange/40"
      >
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.25, ease: [0.34, 1.56, 0.64, 1] }}
        >
          <RiCheckLine className="h-8 w-8 text-vibe-orange" />
        </motion.div>
      </motion.div>
    </div>
  );
}

/* ─────────────────────────── Source card (Step 1) ───────────────────────── */

interface SourceCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}

function SourceCard({ icon, title, description, actionLabel, onAction }: SourceCardProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3.5 rounded-xl border border-border",
        "bg-card hover:bg-muted/40 hover:border-vibe-orange/40",
        "transition-all duration-150 group"
      )}
    >
      <div className="shrink-0 h-10 w-10 rounded-lg bg-vibe-orange/10 flex items-center justify-center group-hover:bg-vibe-orange/20 transition-colors">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground leading-tight">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{description}</p>
      </div>
      <Button
        variant="hollow"
        size="sm"
        onClick={onAction}
        className="shrink-0 text-xs h-8 min-w-0 px-3"
      >
        {actionLabel}
      </Button>
    </div>
  );
}

/* ─────────────────────────── Tip row (Step 2) ───────────────────────────── */

interface TipRowProps {
  icon: React.ReactNode;
  children: React.ReactNode;
}

function TipRow({ icon, children }: TipRowProps) {
  return (
    <div className="flex items-start gap-3">
      <div className="shrink-0 h-8 w-8 rounded-lg bg-vibe-orange/10 flex items-center justify-center mt-0.5">
        {icon}
      </div>
      <p className="text-sm text-muted-foreground leading-snug pt-1.5">{children}</p>
    </div>
  );
}

/* ─────────────────────────── Main component ─────────────────────────────── */

export function OnboardingModal({ open, onComplete, onOpenChange }: OnboardingModalProps) {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();

  const handleFinish = async () => {
    await onComplete();
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      if (step === 0) {
        // Block close on step 0 — user must engage
        return;
      }
      // Steps 1-2: closing completes onboarding
      handleFinish();
    }
    onOpenChange?.(nextOpen);
  };

  /* ── Step 0: Welcome ── */
  const stepWelcome = (
    <motion.div
      key="step-welcome"
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -24 }}
      transition={{ duration: 0.22, ease: "easeInOut" }}
      className="flex flex-col items-center text-center"
    >
      {/* Hero icon */}
      <div className="mt-2 mb-5 relative flex items-center justify-center">
        <div className="absolute h-20 w-20 rounded-full bg-vibe-orange/10 blur-md" />
        <div className="relative h-16 w-16 rounded-2xl bg-vibe-orange/15 border border-vibe-orange/30 flex items-center justify-center shadow-sm">
          <RiRecordCircleLine className="h-8 w-8 text-vibe-orange" />
        </div>
      </div>

      {/* Hidden accessible title/description for Radix */}
      <DialogTitle className="text-2xl font-bold tracking-tight text-foreground">
        Turn every meeting into searchable knowledge
      </DialogTitle>
      <DialogDescription className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-sm">
        CallVault captures, organizes, and surfaces insights from your calls —
        so nothing gets lost after the recording ends.
      </DialogDescription>

      {/* Feature bullets */}
      <div className="mt-5 w-full space-y-2.5 text-left">
        {[
          {
            icon: <RiSearchLine className="h-4 w-4 text-vibe-orange" />,
            text: "Search everything across all your call transcripts",
          },
          {
            icon: <RiFolderLine className="h-4 w-4 text-vibe-orange" />,
            text: "Organize calls into workspaces, folders, and tags",
          },
          {
            icon: <RiBarChartLine className="h-4 w-4 text-vibe-orange" />,
            text: "See patterns across your team's conversations",
          },
        ].map(({ icon, text }, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="shrink-0 h-7 w-7 rounded-md bg-vibe-orange/10 flex items-center justify-center">
              {icon}
            </div>
            <span className="text-sm text-foreground/80">{text}</span>
          </div>
        ))}
      </div>

      {/* CTA */}
      <Button
        className="mt-6 w-full bg-gradient-to-b from-orange-400 to-orange-600 border border-orange-600/70 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_1px_4px_rgba(255,136,0,0.3)] hover:from-orange-500 hover:to-orange-700 active:translate-y-px active:scale-[0.98] transition-all rounded-xl h-11 text-base font-semibold"
        onClick={() => setStep(1)}
      >
        Get Started
        <RiArrowRightLine className="h-4 w-4" />
      </Button>

      {/* Skip footer */}
      <button
        onClick={handleFinish}
        className="mt-3 text-xs text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline"
      >
        Already set up? Skip to the app →
      </button>
    </motion.div>
  );

  /* ── Step 1: Connect your first source ── */
  const stepConnect = (
    <motion.div
      key="step-connect"
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -24 }}
      transition={{ duration: 0.22, ease: "easeInOut" }}
      className="flex flex-col"
    >
      <div className="text-center mb-5">
        <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
          Connect your first source
        </DialogTitle>
        <DialogDescription className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
          CallVault syncs calls from your existing tools. Pick where your recordings live.
        </DialogDescription>
      </div>

      <div className="space-y-2.5">
        <SourceCard
          icon={<RiRobot2Line className="h-5 w-5 text-vibe-orange" />}
          title="Fathom"
          description="Auto-sync call recordings and AI transcripts"
          actionLabel="Connect Fathom"
          onAction={() => navigate("/settings?tab=integrations&wizard=fathom")}
        />
        <SourceCard
          icon={<RiVideoChatLine className="h-5 w-5 text-vibe-orange" />}
          title="Zoom"
          description="Import meetings directly from your Zoom account"
          actionLabel="Connect Zoom"
          onAction={() => navigate("/settings?tab=integrations")}
        />
        <SourceCard
          icon={<RiUpload2Line className="h-5 w-5 text-vibe-orange" />}
          title="Upload a recording"
          description="Drop in an audio or video file and we'll transcribe it"
          actionLabel="Upload file"
          onAction={() => navigate("/import")}
        />
      </div>

      <button
        onClick={() => setStep(2)}
        className="mt-5 text-xs text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline text-center"
      >
        I'll do this later →
      </button>
    </motion.div>
  );

  /* ── Step 2: You're ready ── */
  const stepReady = (
    <motion.div
      key="step-ready"
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -24 }}
      transition={{ duration: 0.22, ease: "easeInOut" }}
      className="flex flex-col items-center text-center"
    >
      <div className="mt-2 mb-5">
        <AnimatedCheck />
      </div>

      <DialogTitle className="text-2xl font-bold tracking-tight text-foreground">
        You're all set!
      </DialogTitle>
      <DialogDescription className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-sm">
        Your workspace is ready. Here's what you can do next:
      </DialogDescription>

      <div className="mt-5 w-full space-y-3 text-left">
        <TipRow icon={<RiKeyboardLine className="h-4 w-4 text-vibe-orange" />}>
          Press <kbd className="font-semibold text-foreground bg-muted px-1 py-0.5 rounded text-xs">⌘K</kbd> to search across all your calls
        </TipRow>
        <TipRow icon={<RiFolderAddLine className="h-4 w-4 text-vibe-orange" />}>
          Create <strong className="text-foreground font-semibold">workspaces</strong> to organize calls by project or team
        </TipRow>
        <TipRow icon={<RiRuler2Line className="h-4 w-4 text-vibe-orange" />}>
          Set up <strong className="text-foreground font-semibold">rules</strong> to auto-tag and sort calls as they come in
        </TipRow>
      </div>

      <Button
        className="mt-6 w-full bg-gradient-to-b from-orange-400 to-orange-600 border border-orange-600/70 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_1px_4px_rgba(255,136,0,0.3)] hover:from-orange-500 hover:to-orange-700 active:translate-y-px active:scale-[0.98] transition-all rounded-xl h-11 text-base font-semibold"
        onClick={() => {
          handleFinish();
          (window as Window & { __startCallVaultTour?: () => void }).__startCallVaultTour?.();
        }}
      >
        Take a quick tour →
      </Button>

      <Button
        variant="ghost"
        className="mt-2 w-full"
        onClick={handleFinish}
      >
        Go to my calls
      </Button>
    </motion.div>
  );

  const steps = [stepWelcome, stepConnect, stepReady];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-lg overflow-hidden"
        aria-describedby={`onboarding-description-step-${step}`}
      >
        {/* Progress dots */}
        <StepDots currentStep={step} />

        {/* Step content with transitions */}
        <div className="relative min-h-[340px]">
          <AnimatePresence mode="wait">
            {steps[step]}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default OnboardingModal;
