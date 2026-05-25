import { useCallback, useState } from "react";
import { RiCheckLine, RiFileCopyLine, RiLinkM } from "@remixicon/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface ConnectorReadonlyUrlFieldProps {
  id?: string;
  label?: string;
  value: string;
  copyLabel?: string;
  copiedLabel?: string;
  copySuccessMessage?: string;
  emptyMessage?: string;
  disabled?: boolean;
  className?: string;
}

export function ConnectorReadonlyUrlField({
  id,
  label = "Webhook URL",
  value,
  copyLabel = "Copy URL",
  copiedLabel = "Copied",
  copySuccessMessage = "Webhook URL copied",
  emptyMessage = "Webhook URL is not ready yet",
  disabled = false,
  className,
}: ConnectorReadonlyUrlFieldProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!value.trim()) {
      toast.error(emptyMessage);
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
  }, [copySuccessMessage, emptyMessage, value]);

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id} className="text-xs flex items-center gap-2">
        <RiLinkM className="h-3.5 w-3.5 text-muted-foreground" />
        {label}
      </Label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id={id}
          value={value}
          readOnly
          className="min-w-0 flex-1 font-mono text-xs"
          disabled={disabled}
        />
        <Button
          type="button"
          variant="hollow"
          onClick={() => void handleCopy()}
          disabled={disabled || !value.trim()}
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
      </div>
    </div>
  );
}
