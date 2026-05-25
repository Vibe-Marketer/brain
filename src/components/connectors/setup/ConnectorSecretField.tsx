import { useCallback, useState } from "react";
import {
  RiCheckLine,
  RiEyeLine,
  RiEyeOffLine,
  RiFileCopyLine,
  RiRefreshLine,
  RiShieldKeyholeLine,
} from "@remixicon/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface ConnectorSecretFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  autoComplete?: string;
  copyLabel?: string;
  copiedLabel?: string;
  copySuccessMessage?: string;
  emptyCopyMessage?: string;
  showCopyButton?: boolean;
  showRevealButton?: boolean;
  regenerateLabel?: string;
  onRegenerate?: () => void;
  className?: string;
}

export function ConnectorSecretField({
  id,
  label,
  value,
  onChange,
  placeholder,
  disabled = false,
  loading = false,
  autoComplete = "new-password",
  copyLabel = "Copy",
  copiedLabel = "Copied",
  copySuccessMessage = "Secret copied",
  emptyCopyMessage = "Enter a secret first",
  showCopyButton = false,
  showRevealButton = true,
  regenerateLabel = "Regenerate",
  onRegenerate,
  className,
}: ConnectorSecretFieldProps) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const isDisabled = disabled || loading;

  const handleCopy = useCallback(async () => {
    if (!value.trim()) {
      toast.error(emptyCopyMessage);
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
      toast.success(copySuccessMessage);
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  }, [copySuccessMessage, emptyCopyMessage, value]);

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id} className="text-xs flex items-center gap-2">
        <RiShieldKeyholeLine className="h-3.5 w-3.5 text-muted-foreground" />
        {label}
      </Label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <Input
            id={id}
            type={showRevealButton ? (revealed ? "text" : "password") : "text"}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={loading ? "Loading..." : placeholder}
            autoComplete={autoComplete}
            data-1p-ignore="true"
            disabled={isDisabled}
            className={cn("font-mono text-xs", showRevealButton && "pr-10")}
          />
          {showRevealButton ? (
            <button
              type="button"
              onClick={() => setRevealed((current) => !current)}
              disabled={isDisabled}
              aria-label={revealed ? `Hide ${label}` : `Show ${label}`}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
            >
              {revealed ? (
                <RiEyeOffLine className="h-3.5 w-3.5" />
              ) : (
                <RiEyeLine className="h-3.5 w-3.5" />
              )}
            </button>
          ) : null}
        </div>
        {showCopyButton ? (
          <Button
            type="button"
            variant="hollow"
            onClick={() => void handleCopy()}
            disabled={isDisabled || !value.trim()}
            className="shrink-0"
          >
            {copied ? (
              <>
                <RiCheckLine className="mr-1.5 h-3.5 w-3.5 text-emerald-500" />
                {copiedLabel}
              </>
            ) : (
              <>
                <RiFileCopyLine className="mr-1.5 h-3.5 w-3.5" />
                {copyLabel}
              </>
            )}
          </Button>
        ) : null}
        {onRegenerate ? (
          <Button
            type="button"
            variant="hollow"
            onClick={onRegenerate}
            disabled={isDisabled}
            className="shrink-0"
          >
            <RiRefreshLine className="mr-1.5 h-3.5 w-3.5" />
            {regenerateLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
