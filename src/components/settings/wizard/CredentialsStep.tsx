import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RiExternalLinkLine, RiEyeLine, RiEyeOffLine } from "@remixicon/react";

interface CredentialsStepProps {
  apiKey: string;
  webhookSecret: string;
  showWebhookSecret: boolean;
  clickedFathomLink: boolean;
  onApiKeyChange: (value: string) => void;
  onWebhookSecretChange: (value: string) => void;
  onToggleSecretVisibility: () => void;
  onFathomLinkClick: () => void;
}

export function CredentialsStep({
  apiKey,
  webhookSecret,
  showWebhookSecret,
  clickedFathomLink,
  onApiKeyChange,
  onWebhookSecretChange,
  onToggleSecretVisibility,
  onFathomLinkClick,
}: CredentialsStepProps) {
  return (
    <div className="space-y-6">
      <ol className="space-y-3 text-sm">
        <li className="flex gap-3 items-start">
          <Badge variant="default" className="shrink-0">1</Badge>
          <div className="flex-1 flex items-center justify-between">
            <span>Open your Fathom API settings</span>
            <Button onClick={onFathomLinkClick}>
              <RiExternalLinkLine className="mr-2 h-4 w-4" />
              Click Here
            </Button>
          </div>
        </li>
        <li className="flex gap-3">
          <Badge variant="default" className="shrink-0">2</Badge>
          <span>Click "Generate New API Key"</span>
        </li>
        <li className="flex gap-3">
          <Badge variant="default" className="shrink-0">3</Badge>
          <span>Copy both credentials and paste below</span>
        </li>
      </ol>

      <Separator />

      <div className={`space-y-4 transition-opacity ${!clickedFathomLink ? "opacity-50 pointer-events-none" : ""}`}>
        <div>
          <Label htmlFor="api-key">API Key *</Label>
          <Input
            id="api-key"
            type="text"
            value={apiKey}
            onChange={(e) => onApiKeyChange(e.target.value)}
            placeholder="fth_xxxxxxxxxxxxxxxxxx"
            className="mt-2"
            disabled={!clickedFathomLink}
          />
        </div>
        <div>
          <Label htmlFor="webhook-secret">Webhook Secret *</Label>
          <div className="relative mt-2">
            <Input
              id="webhook-secret"
              type={showWebhookSecret ? "text" : "password"}
              value={webhookSecret}
              onChange={(e) => onWebhookSecretChange(e.target.value)}
              placeholder="whsec_xxxxxxxxxxxxxxxxxx"
              disabled={!clickedFathomLink}
              className="pr-10"
            />
            <button
              type="button"
              onClick={onToggleSecretVisibility}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              disabled={!clickedFathomLink}
            >
              {showWebhookSecret ? (
                <RiEyeOffLine className="h-4 w-4" />
              ) : (
                <RiEyeLine className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
