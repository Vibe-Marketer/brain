/**
 * OnboardingModal — First-run wizard for new CallVault users.
 *
 * 3-step flow:
 *   Step 1 — Welcome + connect a source
 *   Step 2 — Create your first workspace
 *   Step 3 — Invite your team (or go solo)
 *
 * Completion marks user_profiles.onboarding_completed = true via useOnboarding().
 *
 * @pattern dialog-wizard
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  RiArrowRightLine,
  RiUploadCloud2Line,
  RiVideoLine,
  RiMicLine,
  RiFolderOpenLine,
  RiTeamLine,
  RiUserLine,
  RiCheckLine,
} from "@remixicon/react";
import { CreateWorkspaceDialog } from "@/components/dialogs/CreateWorkspaceDialog";
import { OrganizationInviteDialog } from "@/components/dialogs/OrganizationInviteDialog";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
import { cn } from "@/lib/utils";

interface OnboardingModalProps {
  open: boolean;
  onComplete: () => Promise<void>;
  onOpenChange?: (open: boolean) => void;
}

const TOTAL_STEPS = 3;

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center gap-2 justify-center mb-6">
      {Array.from({ length: TOTAL_STEPS }, (_, i) => {
        const step = i + 1;
        const isDone = step < currentStep;
        const isActive = step === currentStep;
        return (
          <div key={step} className="flex items-center gap-2">
            <div
              className={cn(
                "h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all",
                isDone && "bg-vibe-orange text-white",
                isActive && "bg-vibe-orange/20 text-vibe-orange border border-vibe-orange/50",
                !isDone && !isActive && "bg-muted text-muted-foreground"
              )}
            >
              {isDone ? <RiCheckLine className="h-3.5 w-3.5" /> : step}
            </div>
            {step < TOTAL_STEPS && (
              <div
                className={cn(
                  "h-px w-8 transition-all",
                  isDone ? "bg-vibe-orange" : "bg-border"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

interface SourceCardProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}

function SourceCard({ icon, label, onClick }: SourceCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-3 p-4 rounded-xl border border-border",
        "bg-card hover:bg-muted/50 hover:border-vibe-orange/50",
        "transition-all duration-150 cursor-pointer group"
      )}
    >
      <div className="h-10 w-10 rounded-full bg-vibe-orange/10 flex items-center justify-center group-hover:bg-vibe-orange/20 transition-colors">
        {icon}
      </div>
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}

export function OnboardingModal({ open, onComplete, onOpenChange }: OnboardingModalProps) {
  const [step, setStep] = useState(1);
  const [createWorkspaceOpen, setCreateWorkspaceOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);

  const navigate = useNavigate();
  const { activeOrganizationId, activeOrganization } = useOrganizationContext();

  const handleSkip = () => {
    if (step < TOTAL_STEPS) {
      setStep((s) => s + 1);
    } else {
      handleFinish();
    }
  };

  const handleFinish = async () => {
    await onComplete();
  };

  const handleSourceClick = (tab: string) => {
    // Advance to step 2 first so the modal doesn't close, then navigate
    setStep(2);
    navigate(`/import?tab=${tab}`);
  };

  const handleWorkspaceCreated = () => {
    setCreateWorkspaceOpen(false);
    setStep(3);
  };

  const handleInviteClose = async () => {
    setInviteOpen(false);
    await handleFinish();
  };

  const handleSolo = async () => {
    await handleFinish();
  };

  // Only block close on step 1; allow dismissal from step 2 onwards
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && step === 1) {
      // Treat close-on-step-1 as "skip" — advance to step 2
      setStep(2);
      return;
    }
    if (!nextOpen) {
      handleFinish();
    }
    onOpenChange?.(nextOpen);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className="sm:max-w-lg"
          aria-describedby="onboarding-description"
        >
          <StepIndicator currentStep={step} />

          {/* ── Step 1: Welcome ── */}
          {step === 1 && (
            <>
              <DialogHeader className="text-center items-center">
                <DialogTitle className="text-2xl font-bold">
                  Welcome to CallVault
                </DialogTitle>
                <DialogDescription id="onboarding-description" className="text-base mt-1">
                  The universal call vault for your team — every recording from
                  every tool in one place.
                </DialogDescription>
              </DialogHeader>

              <div className="mt-6 space-y-3">
                <p className="text-sm font-medium text-center text-muted-foreground">
                  Connect your first source to get started
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <SourceCard
                    icon={<RiMicLine className="h-5 w-5 text-vibe-orange" />}
                    label="Connect Fathom"
                    onClick={() => handleSourceClick("fathom")}
                  />
                  <SourceCard
                    icon={<RiVideoLine className="h-5 w-5 text-vibe-orange" />}
                    label="Connect Zoom"
                    onClick={() => handleSourceClick("zoom")}
                  />
                  <SourceCard
                    icon={<RiUploadCloud2Line className="h-5 w-5 text-vibe-orange" />}
                    label="Upload a file"
                    onClick={() => handleSourceClick("upload")}
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-center">
                <button
                  onClick={handleSkip}
                  className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline transition-colors"
                >
                  Skip for now
                </button>
              </div>
            </>
          )}

          {/* ── Step 2: Create workspace ── */}
          {step === 2 && (
            <>
              <DialogHeader className="text-center items-center">
                <div className="h-12 w-12 rounded-full bg-vibe-orange/10 flex items-center justify-center mb-3">
                  <RiFolderOpenLine className="h-6 w-6 text-vibe-orange" />
                </div>
                <DialogTitle className="text-2xl font-bold">
                  Organize your calls
                </DialogTitle>
                <DialogDescription id="onboarding-description" className="text-base mt-1">
                  CallVault uses <strong>Organizations</strong> to group your
                  teams, <strong>Workspaces</strong> to separate projects or
                  clients, and <strong>Folders</strong> to keep calls tidy
                  inside a workspace.
                </DialogDescription>
              </DialogHeader>

              <div className="mt-6 space-y-3">
                <Button
                  className="w-full"
                  onClick={() => setCreateWorkspaceOpen(true)}
                >
                  Create a workspace
                  <RiArrowRightLine className="ml-2 h-4 w-4" />
                </Button>
              </div>

              <div className="mt-4 flex justify-center">
                <button
                  onClick={handleSkip}
                  className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline transition-colors"
                >
                  Skip for now
                </button>
              </div>
            </>
          )}

          {/* ── Step 3: Invite team ── */}
          {step === 3 && (
            <>
              <DialogHeader className="text-center items-center">
                <div className="h-12 w-12 rounded-full bg-vibe-orange/10 flex items-center justify-center mb-3">
                  <RiTeamLine className="h-6 w-6 text-vibe-orange" />
                </div>
                <DialogTitle className="text-2xl font-bold">
                  Invite your team
                </DialogTitle>
                <DialogDescription id="onboarding-description" className="text-base mt-1">
                  CallVault works best with your whole team. Invite teammates so
                  everyone can access and collaborate on calls.
                </DialogDescription>
              </DialogHeader>

              <div className="mt-6 space-y-3">
                <Button
                  className="w-full"
                  onClick={() => setInviteOpen(true)}
                  disabled={!activeOrganizationId}
                >
                  <RiTeamLine className="mr-2 h-4 w-4" />
                  Invite teammates
                </Button>
                <Button
                  variant="hollow"
                  className="w-full"
                  onClick={handleSolo}
                >
                  <RiUserLine className="mr-2 h-4 w-4" />
                  I'm flying solo
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Sub-dialogs — rendered outside the onboarding dialog to avoid nesting issues */}
      <CreateWorkspaceDialog
        open={createWorkspaceOpen}
        onOpenChange={setCreateWorkspaceOpen}
        orgId={activeOrganizationId || undefined}
        onWorkspaceCreated={handleWorkspaceCreated}
      />

      {activeOrganizationId && activeOrganization && (
        <OrganizationInviteDialog
          open={inviteOpen}
          onOpenChange={(isOpen) => {
            if (!isOpen) {
              handleInviteClose();
            } else {
              setInviteOpen(true);
            }
          }}
          organizationId={activeOrganizationId}
          organizationName={activeOrganization.name}
        />
      )}
    </>
  );
}

export default OnboardingModal;
