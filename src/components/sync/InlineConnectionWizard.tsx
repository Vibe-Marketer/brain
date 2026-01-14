import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  RiGoogleLine,
  RiVideoLine,
  RiCalendarLine,
  RiFlashlightLine,
  RiLoader4Line,
  RiAlertLine,
  RiCloseLine,
  RiArrowLeftLine,
} from "@remixicon/react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { getGoogleOAuthUrl, getFathomOAuthUrl, getZoomOAuthUrl } from "@/lib/api-client";
import { type IntegrationPlatform } from "./IntegrationSyncPane";
import { FathomIcon } from "@/components/transcript-library/SourcePlatformIcons";

interface InlineConnectionWizardProps {
  platform: IntegrationPlatform;
  onComplete: () => void;
  onCancel: () => void;
}

interface StepCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

function StepCard({ icon, title, description }: StepCardProps) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border border-border dark:border-cb-border-dark">
      <div className="text-vibe-orange">{icon}</div>
      <div>
        <p className="font-medium text-sm">{title}</p>
        <p className="text-xs text-ink-muted">{description}</p>
      </div>
    </div>
  );
}

export function InlineConnectionWizard({
  platform,
  onComplete: _onComplete,
  onCancel,
}: InlineConnectionWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [connecting, setConnecting] = useState(false);
  const [acknowledgedWarning, setAcknowledgedWarning] = useState(false);

  const handleOAuthConnect = async () => {
    try {
      setConnecting(true);

      let response;
      if (platform === "google_meet") {
        response = await getGoogleOAuthUrl();
      } else if (platform === "fathom") {
        response = await getFathomOAuthUrl();
      } else if (platform === "zoom") {
        response = await getZoomOAuthUrl();
      } else {
        throw new Error(`Unsupported platform: ${platform}`);
      }

      if (response.data?.authUrl) {
        // Store a flag to indicate we're completing OAuth and should refresh
        sessionStorage.setItem('pendingOAuthPlatform', platform);
        window.location.href = response.data.authUrl;
      } else if (response.error) {
        throw new Error(response.error);
      } else {
        throw new Error("No OAuth URL returned");
      }
    } catch (error) {
      logger.error(`Failed to get ${platform} OAuth URL`, error);
      const platformName = platform === 'google_meet' ? 'Google' : platform === 'zoom' ? 'Zoom' : 'Fathom';
      toast.error(`Failed to connect to ${platformName}`);
      setConnecting(false);
    }
  };

  // Platform-specific configurations
  const platformConfig = {
    fathom: {
      name: "Fathom",
      icon: <RiVideoLine className="h-6 w-6" />,
      color: "text-purple-600 dark:text-purple-400",
      features: [
        {
          icon: <RiVideoLine className="h-4 w-4" />,
          title: "Meeting Recordings",
          description: "Access your recorded meetings",
        },
        {
          icon: <RiFlashlightLine className="h-4 w-4" />,
          title: "AI Transcripts",
          description: "Import Fathom's AI-generated transcripts",
        },
        {
          icon: <RiCalendarLine className="h-4 w-4" />,
          title: "Meeting Metadata",
          description: "Sync attendees, dates, and summaries",
        },
      ],
      warningTitle: "API Access Required",
      warningContent: (
        <p className="text-sm text-muted-foreground">
          You'll need a Fathom account with API access. Personal plans include this feature.
          Enterprise users should check with their admin.
        </p>
      ),
    },
    google_meet: {
      name: "Google Meet",
      icon: <RiGoogleLine className="h-6 w-6" />,
      color: "text-blue-600 dark:text-blue-400",
      features: [
        {
          icon: <RiCalendarLine className="h-4 w-4" />,
          title: "Calendar Discovery",
          description: "Find meetings with Google Meet links",
        },
        {
          icon: <RiVideoLine className="h-4 w-4" />,
          title: "Recording Retrieval",
          description: "Download recordings from Google Drive",
        },
        {
          icon: <RiFlashlightLine className="h-4 w-4" />,
          title: "Transcript Sync",
          description: "Import native or generate AI transcripts",
        },
      ],
      warningTitle: "Recording Requirements",
      warningContent: (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Google Meet recordings are only available for:
          </p>
          <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
            <li>Google Workspace Business Standard, Plus, or Enterprise</li>
            <li>Google Workspace Education Plus</li>
            <li>Teaching and Learning Upgrade</li>
          </ul>
          <p className="text-sm text-muted-foreground">
            Personal accounts can sync meeting data but won't have recordings.
          </p>
          <div className="mt-3 pt-3 border-t border-border">
            <p className="text-sm font-medium">Have a personal Google account?</p>
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
      ),
    },
    zoom: {
      name: "Zoom",
      icon: <RiVideoLine className="h-6 w-6" />,
      color: "text-sky-600 dark:text-sky-400",
      features: [
        {
          icon: <RiVideoLine className="h-4 w-4" />,
          title: "Cloud Recordings",
          description: "Access your Zoom cloud recordings",
        },
        {
          icon: <RiFlashlightLine className="h-4 w-4" />,
          title: "Transcripts",
          description: "Import Zoom's auto-generated transcripts",
        },
        {
          icon: <RiCalendarLine className="h-4 w-4" />,
          title: "Meeting Details",
          description: "Sync participants, dates, and duration",
        },
      ],
      warningTitle: "Cloud Recording Required",
      warningContent: (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Zoom cloud recording is required for importing recordings. This feature is available on:
          </p>
          <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
            <li>Zoom Pro, Business, Education, or Enterprise plans</li>
            <li>Accounts with cloud recording enabled by admin</li>
          </ul>
          <p className="text-sm text-muted-foreground">
            Local recordings cannot be imported automatically.
          </p>
        </div>
      ),
    },
  };

  const config = platformConfig[platform];

  // Step content renderers
  const renderWelcomeStep = () => (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Sync your {config.name} recordings and transcripts automatically:
      </p>
      <div className="space-y-2">
        {config.features.map((feature, idx) => (
          <StepCard
            key={idx}
            icon={feature.icon}
            title={feature.title}
            description={feature.description}
          />
        ))}
      </div>
      <p className="text-xs text-ink-muted">
        Just 2 quick steps - review requirements and authorize.
      </p>
    </div>
  );

  const renderWarningStep = () => (
    <div className="space-y-4">
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <RiAlertLine className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="space-y-2">
            <p className="font-medium text-amber-500">{config.warningTitle}</p>
            {config.warningContent}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="acknowledge-warning"
          checked={acknowledgedWarning}
          onChange={(e) => setAcknowledgedWarning(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
        />
        <label htmlFor="acknowledge-warning" className="text-sm text-muted-foreground">
          I understand the requirements
        </label>
      </div>
    </div>
  );

  const renderConnectStep = () => (
    <div className="space-y-4">
      <div className="space-y-2 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="text-success">✓</span>
          <span>Requirements reviewed</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-success">✓</span>
          <span>Permissions understood</span>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Click below to authorize CallVault. You'll be redirected to {config.name}'s login page.
      </p>

      <div className="flex justify-center py-2">
        <Button
          onClick={handleOAuthConnect}
          disabled={connecting}
          size="lg"
          className="px-8"
        >
          {connecting ? (
            <>
              <RiLoader4Line className="mr-2 h-4 w-4 animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              {config.icon}
              <span className="ml-2">Connect with {config.name}</span>
            </>
          )}
        </Button>
      </div>

      <p className="text-xs text-ink-muted text-center">
        You'll sign in, authorize CallVault, then return here.
      </p>
    </div>
  );

  const steps = [
    { title: `Connect ${config.name}`, render: renderWelcomeStep },
    { title: "Important Information", render: renderWarningStep },
    { title: "Authorize", render: renderConnectStep },
  ];

  const canProceed = () => {
    if (currentStep === 1) {
      return acknowledgedWarning;
    }
    return true;
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    } else {
      onCancel();
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={config.color}>{config.icon}</div>
          <div>
            <h3 className="font-medium">{steps[currentStep].title}</h3>
            <p className="text-xs text-ink-muted">
              Step {currentStep + 1} of {steps.length}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="h-8 w-8 p-0"
          disabled={connecting}
        >
          <RiCloseLine className="h-4 w-4" />
        </Button>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-muted/50 h-2 rounded-full overflow-hidden">
        <div
          className="h-full transition-all duration-300 rounded-full bg-vibe-orange"
          style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
        />
      </div>

      <Separator />

      {/* Step content */}
      <div className="py-2">
        {steps[currentStep].render()}
      </div>

      <Separator />

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="hollow"
          size="sm"
          onClick={handleBack}
          disabled={connecting}
        >
          <RiArrowLeftLine className="mr-1 h-4 w-4" />
          {currentStep === 0 ? "Cancel" : "Back"}
        </Button>

        {currentStep < steps.length - 1 && (
          <Button
            size="sm"
            onClick={handleNext}
            disabled={!canProceed() || connecting}
          >
            Next
          </Button>
        )}
      </div>
    </div>
  );
}
