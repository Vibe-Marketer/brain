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
  RiBrainLine,
  RiFlashlightLine,
  RiLoader4Line,
  RiVideoLine,
  RiCloudLine,
  RiFileTextLine,
} from "@remixicon/react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { callEdgeFunction } from "@/lib/api-client";
import { StepCard } from "./wizard/StepCard";

interface ZoomSetupWizardProps {
  open: boolean;
  onComplete: () => void;
  onDismiss?: () => void;
}

export default function ZoomSetupWizard({ open, onComplete: _onComplete, onDismiss }: ZoomSetupWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [oauthConnecting, setOauthConnecting] = useState(false);

  const handleOAuthConnect = async () => {
    try {
      setOauthConnecting(true);
      const response = await callEdgeFunction<{ authUrl: string }>("zoom-oauth-url", undefined, { retry: false });
      if (response.data?.authUrl) {
        window.location.href = response.data.authUrl;
      } else if (response.error) {
        throw new Error(response.error);
      } else {
        throw new Error("No OAuth URL returned");
      }
    } catch (error) {
      logger.error("Failed to get Zoom OAuth URL", error);
      toast.error("Failed to connect to Zoom");
      setOauthConnecting(false);
    }
  };

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

  const steps = [
    {
      title: "CONNECT ZOOM TO CALLVAULT™",
      stepNumber: null,
      icon: <RiBrainLine className="h-8 w-8 text-primary" />,
      content: <ZoomWelcomeStep />,
    },
    {
      title: "AUTHORIZE ZOOM ACCESS",
      stepNumber: 1,
      icon: <RiFlashlightLine className="h-8 w-8 text-primary" />,
      content: (
        <ZoomOAuthStep
          oauthConnecting={oauthConnecting}
          onOAuthConnect={handleOAuthConnect}
        />
      ),
    },
  ];

  const currentStepData = steps[currentStep];
  const totalSteps = 1; // Only 1 actual step since welcome isn't counted
  const progress = currentStepData.stepNumber
    ? (currentStepData.stepNumber / totalSteps) * 100
    : 0;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onDismiss?.()} modal>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-4 mb-4">
            {currentStepData.icon}
            <div className="flex-1">
              <DialogTitle className="text-2xl">{currentStepData.title}</DialogTitle>
              {currentStepData.stepNumber && (
                <DialogDescription className="mt-1">
                  Step {currentStepData.stepNumber} of {totalSteps}
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

          {currentStep === 0 && (
            <Button onClick={handleNext}>
              Next
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Welcome step component
function ZoomWelcomeStep() {
  return (
    <div className="space-y-6">
      <p className="text-muted-foreground font-medium">
        Sync your Zoom cloud recordings directly:
      </p>
      <div className="grid gap-3">
        <StepCard
          icon={<RiCloudLine className="h-5 w-5" />}
          title="Cloud Recordings"
          description="Access recordings from your Zoom account"
        />
        <StepCard
          icon={<RiFileTextLine className="h-5 w-5" />}
          title="Native Transcripts"
          description="Import Zoom's built-in transcripts automatically"
        />
        <StepCard
          icon={<RiFlashlightLine className="h-5 w-5" />}
          title="Auto-Sync"
          description="New recordings sync when transcripts are ready"
        />
      </div>

      <div className="p-4 rounded-lg bg-muted/50 border border-border dark:border-cb-border-dark">
        <div className="flex items-start gap-3">
          <RiVideoLine className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Requirements</p>
            <ul className="mt-1 space-y-1 list-disc list-inside">
              <li>Zoom Pro or Business account</li>
              <li>Cloud recording enabled</li>
              <li>Audio transcription enabled in settings</li>
            </ul>
          </div>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Just 1 quick step — connect via OAuth and you're done.
      </p>
    </div>
  );
}

// OAuth step component
interface ZoomOAuthStepProps {
  oauthConnecting: boolean;
  onOAuthConnect: () => void;
}

function ZoomOAuthStep({ oauthConnecting, onOAuthConnect }: ZoomOAuthStepProps) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Click the button below to authorize CallVault™ to access your Zoom cloud recordings.
        You'll be redirected to Zoom to sign in and approve the connection.
      </p>

      <div className="p-4 rounded-lg bg-muted/50 border border-border dark:border-cb-border-dark">
        <p className="text-sm font-medium mb-2">CallVault™ will have access to:</p>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li>View your cloud recordings</li>
          <li>Download recording transcripts</li>
          <li>Read your user profile</li>
        </ul>
      </div>

      {/* Primary OAuth Button */}
      <div className="flex justify-center py-4">
        <Button
          onClick={onOAuthConnect}
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
              <RiVideoLine className="mr-2 h-5 w-5" />
              Connect with Zoom
            </>
          )}
        </Button>
      </div>

      <p className="text-sm text-muted-foreground text-center">
        You'll sign into Zoom, authorize CallVault™, then return here automatically.
      </p>
    </div>
  );
}
