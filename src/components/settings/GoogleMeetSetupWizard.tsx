import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  RiGoogleLine,
  RiCalendarLine,
  RiVideoLine,
  RiFlashlightLine,
  RiLoader4Line,
  RiAlertLine,
} from "@remixicon/react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { getGoogleOAuthUrl } from "@/lib/api-client";
import { StepCard } from "./wizard/StepCard";
import { FathomIcon } from "@/components/transcript-library/SourcePlatformIcons";

interface GoogleMeetSetupWizardProps {
  open: boolean;
  onComplete: () => void;
  onDismiss?: () => void;
}

export default function GoogleMeetSetupWizard({
  open,
  onComplete: _onComplete,
  onDismiss
}: GoogleMeetSetupWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [oauthConnecting, setOauthConnecting] = useState(false);
  const [acknowledgedWorkspaceWarning, setAcknowledgedWorkspaceWarning] = useState(false);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleOAuthConnect = async () => {
    try {
      setOauthConnecting(true);
      const response = await getGoogleOAuthUrl();
      if (response.data?.authUrl) {
        window.location.href = response.data.authUrl;
      } else if (response.error) {
        throw new Error(response.error);
      } else {
        throw new Error("No OAuth URL returned");
      }
    } catch (error) {
      logger.error("Failed to get Google OAuth URL", error);
      toast.error("Failed to connect to Google");
      setOauthConnecting(false);
    }
  };

  // Welcome Step Content
  const WelcomeContent = () => (
    <div className="space-y-6">
      <p className="text-muted-foreground font-medium">
        Sync your Google Meet recordings and transcripts automatically:
      </p>
      <div className="grid gap-3">
        <StepCard
          icon={<RiCalendarLine className="h-5 w-5" />}
          title="Calendar Discovery"
          description="Find meetings with Google Meet links"
        />
        <StepCard
          icon={<RiVideoLine className="h-5 w-5" />}
          title="Recording Retrieval"
          description="Download recordings from Google Drive"
        />
        <StepCard
          icon={<RiFlashlightLine className="h-5 w-5" />}
          title="Transcript Sync"
          description="Import native or generate AI transcripts"
        />
      </div>

      <p className="text-sm text-muted-foreground">
        Just 2 quick steps - authorize Google and you're done.
      </p>
    </div>
  );

  // Important Information Step Content
  const WorkspaceInfoContent = () => (
    <div className="space-y-6">
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <RiAlertLine className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="space-y-2">
            <p className="font-medium text-amber-500">Recording Requirements</p>
            <p className="text-sm text-muted-foreground">
              Google Meet recordings are only available for:
            </p>
            <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
              <li>Google Workspace Business Standard, Plus, or Enterprise</li>
              <li>Google Workspace Education Plus</li>
              <li>Teaching and Learning Upgrade</li>
            </ul>
            <p className="text-sm text-muted-foreground">
              Personal Google accounts can sync meeting data from Calendar, but recordings
              won't be available unless you have a qualifying Workspace subscription.
            </p>
            <div className="mt-3 pt-3 border-t border-amber-500/20">
              <p className="text-sm font-medium text-foreground">Have a personal Google account?</p>
              <p className="text-sm text-muted-foreground mt-1">
                Connect Fathom instead - it's free and works with any account.
              </p>
              <a
                href="https://vibelinks.co/fathom"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 mt-2 px-3 py-1.5 text-sm font-medium rounded-md border border-border bg-card hover:bg-muted transition-colors"
              >
                <FathomIcon size={16} />
                Sign up for Fathom (Free)
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="acknowledge-workspace"
          checked={acknowledgedWorkspaceWarning}
          onChange={(e) => setAcknowledgedWorkspaceWarning(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
        />
        <label htmlFor="acknowledge-workspace" className="text-sm text-muted-foreground">
          I understand the recording requirements
        </label>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium">What CallVault will access:</p>
        <ul className="text-sm text-muted-foreground space-y-2">
          <li className="flex items-center gap-2">
            <RiCalendarLine className="h-4 w-4 text-primary" />
            <span>Google Calendar (read-only) - to find meetings with Meet links</span>
          </li>
          <li className="flex items-center gap-2">
            <RiVideoLine className="h-4 w-4 text-primary" />
            <span>Google Drive (read-only) - to download recordings and transcripts</span>
          </li>
        </ul>
      </div>
    </div>
  );

  // OAuth Step Content
  const OAuthContent = () => (
    <div className="space-y-6">
      <ul className="space-y-2 text-sm">
        <li className="flex items-center gap-3">
          <span className="text-lg">&#10003;</span>
          <span>Requirements reviewed</span>
        </li>
        <li className="flex items-center gap-3">
          <span className="text-lg">&#10003;</span>
          <span>Permissions understood</span>
        </li>
      </ul>

      <p className="text-sm text-muted-foreground">
        Click below to authorize CallVault to access your Google account.
        You'll be redirected to Google's login page.
      </p>

      <div className="flex justify-center py-4">
        <Button
          onClick={handleOAuthConnect}
          disabled={oauthConnecting}
          size="lg"
          className="px-10 py-6 text-base"
        >
          {oauthConnecting ? (
            <>
              <RiLoader4Line className="mr-2 h-5 w-5 animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <RiGoogleLine className="mr-2 h-5 w-5" />
              Connect with Google
            </>
          )}
        </Button>
      </div>

      <p className="text-sm text-muted-foreground text-center">
        You'll sign into Google, authorize CallVault, then land back here.
      </p>
    </div>
  );

  const steps = [
    {
      title: "CONNECT GOOGLE MEET",
      stepNumber: null,
      icon: <RiGoogleLine className="h-8 w-8 text-primary" />,
      content: <WelcomeContent />,
    },
    {
      title: "STEP 1: IMPORTANT INFORMATION",
      stepNumber: 1,
      icon: <RiAlertLine className="h-8 w-8 text-primary" />,
      content: <WorkspaceInfoContent />,
    },
    {
      title: "STEP 2: AUTHORIZE GOOGLE",
      stepNumber: 2,
      icon: <RiFlashlightLine className="h-8 w-8 text-primary" />,
      content: <OAuthContent />,
    },
  ];

  const currentStepData = steps[currentStep];
  const totalSteps = 2;
  const progress = currentStepData.stepNumber
    ? (currentStepData.stepNumber / totalSteps) * 100
    : 0;

  const canProceed = () => {
    if (currentStep === 1) {
      return acknowledgedWorkspaceWarning;
    }
    return true;
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onDismiss?.()} modal>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-4 mb-4">
            {currentStepData.icon}
            <div className="flex-1">
              <DialogTitle className="text-2xl">{currentStepData.title}</DialogTitle>
              {currentStepData.stepNumber ? (
                <DialogDescription className="mt-1">
                  Step {currentStepData.stepNumber} of {totalSteps}
                </DialogDescription>
              ) : (
                <DialogDescription className="sr-only">
                  Google Meet setup steps and authorization flow
                </DialogDescription>
              )}
            </div>
          </div>

          {currentStepData.stepNumber && (
            <div className="w-full bg-muted/50 h-3 rounded-full overflow-hidden border border-border dark:border-cb-border-dark">
              <div
                className="h-full transition-all duration-300 rounded-full bg-vibe-orange"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </DialogHeader>

        <div className="py-6">{currentStepData.content}</div>

        <div className="flex items-center justify-between pt-6 border-t">
          <Button
            variant="hollow"
            onClick={handleBack}
            disabled={currentStep === 0 || oauthConnecting}
          >
            Back
          </Button>

          {currentStep < steps.length - 1 && (
            <Button
              onClick={handleNext}
              disabled={!canProceed() || oauthConnecting}
            >
              Next
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
