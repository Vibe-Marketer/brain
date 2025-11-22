import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RiCheckLine, RiExternalLinkLine } from "@remixicon/react";
import { toast } from "sonner";

interface WebhookStepProps {
  webhookUrl: string;
  webhookCopied: boolean;
  onWebhookCopy: () => void;
}

export function WebhookStep({ webhookUrl, webhookCopied, onWebhookCopy }: WebhookStepProps) {
  const handleCopy = () => {
    navigator.clipboard.writeText(webhookUrl);
    onWebhookCopy();
    toast.success("Webhook URL copied!");
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <Badge variant="default" className="shrink-0">1</Badge>
          <div className="flex-1 space-y-3">
            <p className="font-medium">Copy this webhook URL</p>
            <div className="flex gap-2">
              <Input
                value={webhookUrl}
                readOnly
                className="flex-1 font-mono text-sm"
              />
              <Button
                onClick={handleCopy}
                className={webhookCopied ? "" : "ring-2 ring-destructive ring-offset-2"}
              >
                <RiCheckLine className="mr-2 h-4 w-4" />
                {webhookCopied ? "Copied!" : "Copy"}
              </Button>
            </div>
          </div>
        </div>

        <Separator />

        <div className="flex items-start gap-3">
          <Badge variant="default" className="shrink-0">2</Badge>
          <div className="flex-1 flex items-center justify-between">
            <p className="font-medium">Open Fathom webhook settings</p>
            <Button
              onClick={() => window.open("https://fathom.video/api_settings/new", "_blank")}
            >
              <RiExternalLinkLine className="mr-2 h-4 w-4" />
              Click Here
            </Button>
          </div>
        </div>

        <Separator />

        <div className="flex items-start gap-3">
          <Badge variant="default" className="shrink-0">3</Badge>
          <div className="flex-1">
            <p className="font-medium">Add new webhook</p>
            <p className="text-sm text-muted-foreground mt-1">
              Paste the URL you copied in step 1
            </p>
          </div>
        </div>

        <Separator />

        <div className="flex items-start gap-3">
          <Badge variant="default" className="shrink-0">4</Badge>
          <div className="flex-1">
            <p className="font-medium mb-2">Enable these in Fathom (you'll confirm on next screen):</p>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>• Internal Recordings (required)</li>
              <li>• External Recordings (recommended)</li>
              <li>• Transcripts event (required)</li>
              <li>• Summaries event (recommended)</li>
              <li>• Action Items event (recommended)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
