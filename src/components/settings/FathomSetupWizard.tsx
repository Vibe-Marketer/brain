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
  RiKeyLine,
  RiWebhookLine,
  RiSettings3Line,
  RiFlashlightLine,
  RiLoader4Line,
} from "@remixicon/react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { getFathomOAuthUrl } from "@/lib/api-client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { WelcomeStep } from "./wizard/WelcomeStep";
import { CredentialsStep } from "./wizard/CredentialsStep";
import { WebhookStep } from "./wizard/WebhookStep";
import { SettingsStep } from "./wizard/SettingsStep";
import { OAuthStep } from "./wizard/OAuthStep";

interface FathomSetupWizardProps {
  open: boolean;
  onComplete: () => void;
}

export default function FathomSetupWizard({ open, onComplete: _onComplete }: FathomSetupWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [apiKey, setApiKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [oauthConnecting, setOauthConnecting] = useState(false);

  // Step 1 state
  const [clickedFathomLink, setClickedFathomLink] = useState(false);

  // Webhook step state
  const [webhookCopied, setWebhookCopied] = useState(false);

  // Password visibility
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);

  // Scope/Event selections
  const [myRecordings, setMyRecordings] = useState(true);
  const [externalRecordings, setExternalRecordings] = useState(false);
  const [transcripts, setTranscripts] = useState(true);
  const [summaries, setSummaries] = useState(true);
  const [actions, setActions] = useState(true);

  // Warning modal
  const [showWarning, setShowWarning] = useState(false);
  const [uncheckedItems, setUncheckedItems] = useState<string[]>([]);

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/webhook`;

  const validateStep = (): boolean => {
    switch (currentStep) {
      case 1: // API credentials step
        if (!apiKey || !webhookSecret) {
          toast.error("Please enter both API Key and Webhook Secret");
          return false;
        }
        return true;
      case 2: // Webhook configuration step
        if (!webhookCopied) {
          toast.error("Please copy the webhook URL before proceeding");
          return false;
        }
        return true;
      case 3: { // Scopes/Events step
        const unchecked: string[] = [];
        if (!myRecordings) unchecked.push("My Recordings");
        if (!externalRecordings) unchecked.push("External Recordings");
        if (!transcripts) unchecked.push("Transcripts");
        if (!summaries) unchecked.push("Summaries");
        if (!actions) unchecked.push("Actions");

        if (unchecked.length > 0) {
          setUncheckedItems(unchecked);
          setShowWarning(true);
          return false;
        }
        return true;
      }
      default:
        return true;
    }
  };

  const handleWarningConfirm = () => {
    setShowWarning(false);
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const saveCredentials = async () => {
    try {
      setSaving(true);
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        toast.error("Not authenticated");
        return false;
      }

      // Basic validation - ensure API key is not empty (format varies)
      if (apiKey.trim().length === 0) {
        toast.error("API key cannot be empty");
        return false;
      }

      if (!webhookSecret.startsWith('whsec_')) {
        toast.error("Invalid webhook secret format. Should start with 'whsec_'");
        return false;
      }

      const { error } = await supabase
        .from("user_settings")
        .upsert({
          user_id: user.id,
          fathom_api_key: apiKey.trim(),
          webhook_secret: webhookSecret.trim(),
        }, {
          onConflict: "user_id"
        });

      if (error) {
        logger.error("Failed to save credentials", error);
        toast.error("Failed to save credentials: " + error.message);
        return false;
      }

      toast.success("Credentials saved successfully");
      return true;
    } catch (error) {
      logger.error("Error saving credentials", error);
      toast.error("Failed to save credentials");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleNext = async () => {
    if (!validateStep()) return;

    if (currentStep === 1) {
      const saved = await saveCredentials();
      if (!saved) return;
    }

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
      const response = await getFathomOAuthUrl();
      if (response.data?.authUrl) {
        window.location.href = response.data.authUrl;
      } else if (response.error) {
        throw new Error(response.error);
      } else {
        throw new Error("No OAuth URL returned");
      }
    } catch (error) {
      logger.error("Failed to get OAuth URL", error);
      toast.error("Failed to connect to Fathom");
      setOauthConnecting(false);
    }
  };

  const steps = [
    {
      title: "CONNECT FATHOM TO CONVERSION BRAIN™",
      stepNumber: null,
      icon: <RiBrainLine className="h-8 w-8 text-primary" />,
      content: <WelcomeStep />,
    },
    {
      title: "STEP 1: GET FATHOM API CREDENTIALS",
      stepNumber: 1,
      icon: <RiKeyLine className="h-8 w-8 text-primary" />,
      content: (
        <CredentialsStep
          apiKey={apiKey}
          webhookSecret={webhookSecret}
          showWebhookSecret={showWebhookSecret}
          clickedFathomLink={clickedFathomLink}
          onApiKeyChange={setApiKey}
          onWebhookSecretChange={setWebhookSecret}
          onToggleSecretVisibility={() => setShowWebhookSecret(!showWebhookSecret)}
          onFathomLinkClick={() => {
            setClickedFathomLink(true);
            window.open("https://fathom.video/api_settings/new", "_blank");
          }}
        />
      ),
    },
    {
      title: "STEP 2: PASTE WEBHOOK IN FATHOM",
      stepNumber: 2,
      icon: <RiWebhookLine className="h-8 w-8 text-primary" />,
      content: (
        <WebhookStep
          webhookUrl={webhookUrl}
          webhookCopied={webhookCopied}
          onWebhookCopy={() => setWebhookCopied(true)}
        />
      ),
    },
    {
      title: "STEP 3: CONFIRM FATHOM SETTINGS",
      stepNumber: 3,
      icon: <RiSettings3Line className="h-8 w-8 text-primary" />,
      content: (
        <SettingsStep
          myRecordings={myRecordings}
          externalRecordings={externalRecordings}
          transcripts={transcripts}
          summaries={summaries}
          actions={actions}
          onMyRecordingsChange={setMyRecordings}
          onExternalRecordingsChange={setExternalRecordings}
          onTranscriptsChange={setTranscripts}
          onSummariesChange={setSummaries}
          onActionsChange={setActions}
        />
      ),
    },
    {
      title: "STEP 4: AUTHORIZE ONGOING SYNC",
      stepNumber: 4,
      icon: <RiFlashlightLine className="h-8 w-8 text-primary" />,
      content: (
        <OAuthStep
          oauthConnecting={oauthConnecting}
          onOAuthConnect={handleOAuthConnect}
        />
      ),
    },
  ];

  const currentStepData = steps[currentStep];
  const totalSteps = 4;
  const progress = currentStepData.stepNumber
    ? (currentStepData.stepNumber / totalSteps) * 100
    : 0;

  return (
    <>
      <Dialog open={open} onOpenChange={() => {}} modal>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto [&>button]:hidden">
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
              <div className="w-full bg-muted/50 h-3 rounded-full overflow-hidden border border-cb-border dark:border-cb-border-dark">
                <div
                  className="h-full transition-all duration-300 rounded-full bg-vibe-green"
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
              disabled={currentStep === 0 || saving || oauthConnecting}
            >
              Back
            </Button>

            {currentStep < steps.length - 1 && (
              <Button
                onClick={handleNext}
                disabled={saving || oauthConnecting}
              >
                {saving ? (
                  <>
                    <RiLoader4Line className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Next"
                )}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showWarning} onOpenChange={setShowWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="uppercase">CONFIRM SKIPPED OPTIONS</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>You have not enabled the following options in Fathom:</p>
                <ul className="list-disc pl-5 space-y-1">
                  {uncheckedItems.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <p className="font-medium">
                  We strongly recommend enabling all of these for the best experience.
                </p>
                <p className="text-sm">Continue anyway?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Go Back</AlertDialogCancel>
            <AlertDialogAction onClick={handleWarningConfirm}>
              Continue Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
