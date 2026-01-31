/**
 * ReengagementEmailModal - Modal for generating and sending check-in emails
 *
 * Features:
 * - Customizable prompt template
 * - AI-generated email preview
 * - Editable generated content
 * - Copy to clipboard and open in email client
 *
 * @brand-version v4.2
 */

import * as React from "react";
import {
  RiMailLine,
  RiMagicLine,
  RiFileCopyLine,
  RiExternalLinkLine,
  RiCloseLine,
  RiRefreshLine,
} from "@remixicon/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useHealthAlerts, DEFAULT_REENGAGEMENT_PROMPT } from "@/hooks/useHealthAlerts";
import type { ContactWithCallCount } from "@/types/contacts";

export interface ReengagementEmailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: ContactWithCallCount | null;
}

export function ReengagementEmailModal({
  open,
  onOpenChange,
  contact,
}: ReengagementEmailModalProps) {
  const { generateReengagementEmail, isGenerating } = useHealthAlerts();

  // Form state
  const [prompt, setPrompt] = React.useState(DEFAULT_REENGAGEMENT_PROMPT);
  const [subject, setSubject] = React.useState("");
  const [body, setBody] = React.useState("");
  const [hasGenerated, setHasGenerated] = React.useState(false);

  // Reset state when modal opens with new contact
  React.useEffect(() => {
    if (open && contact) {
      setPrompt(DEFAULT_REENGAGEMENT_PROMPT);
      setSubject("");
      setBody("");
      setHasGenerated(false);
    }
  }, [open, contact?.id]);

  const handleGenerate = async () => {
    if (!contact) return;

    const result = await generateReengagementEmail(contact, prompt);
    if (result) {
      setSubject(result.subject);
      setBody(result.body);
      setHasGenerated(true);
    }
  };

  const handleCopyToClipboard = async () => {
    const fullEmail = `Subject: ${subject}\n\n${body}`;
    try {
      await navigator.clipboard.writeText(fullEmail);
      toast.success("Email copied to clipboard");
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  };

  const handleOpenInEmailClient = () => {
    if (!contact) return;
    
    const mailtoUrl = `mailto:${contact.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoUrl, "_blank");
  };

  const contactName = contact?.name || contact?.email.split("@")[0] || "Contact";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RiMailLine className="h-5 w-5 text-cb-ink-muted" />
            Send check-in to {contactName}
          </DialogTitle>
          <DialogDescription>
            Generate a personalized re-engagement email using AI.
            {contact?.email && (
              <span className="block text-xs mt-1">{contact.email}</span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Prompt Section */}
          <div className="space-y-2">
            <Label htmlFor="prompt" className="text-sm font-medium">
              Prompt template
            </Label>
            <Textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the email you want to generate..."
              className="min-h-[120px] text-sm"
            />
            <p className="text-xs text-cb-ink-muted">
              Use {"{{contact_name}}"} and {"{{contact_email}}"} as placeholders.
            </p>
          </div>

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !contact}
            className="w-full"
          >
            {isGenerating ? (
              <>
                <RiRefreshLine className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <RiMagicLine className="h-4 w-4 mr-2" />
                {hasGenerated ? "Regenerate email" : "Generate email"}
              </>
            )}
          </Button>

          {/* Generated Email Preview */}
          {(hasGenerated || isGenerating) && (
            <div className="space-y-4 pt-4 border-t border-border">
              {isGenerating ? (
                <div className="space-y-3">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-32 w-full" />
                </div>
              ) : (
                <>
                  {/* Subject Line */}
                  <div className="space-y-2">
                    <Label htmlFor="subject" className="text-sm font-medium">
                      Subject
                    </Label>
                    <Input
                      id="subject"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="Email subject..."
                    />
                  </div>

                  {/* Email Body */}
                  <div className="space-y-2">
                    <Label htmlFor="body" className="text-sm font-medium">
                      Email body
                    </Label>
                    <Textarea
                      id="body"
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      placeholder="Email content..."
                      className="min-h-[180px] text-sm"
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 pt-2">
                    <Button
                      variant="outline"
                      onClick={handleCopyToClipboard}
                      className="flex-1"
                    >
                      <RiFileCopyLine className="h-4 w-4 mr-2" />
                      Copy to clipboard
                    </Button>
                    <Button
                      onClick={handleOpenInEmailClient}
                      className="flex-1"
                    >
                      <RiExternalLinkLine className="h-4 w-4 mr-2" />
                      Open in email client
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
