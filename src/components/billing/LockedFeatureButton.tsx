import { useMemo, useState } from "react";
import { RiLockLine } from "@remixicon/react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { PaywallDialog } from "@/components/billing/PaywallDialog";

interface LockedFeatureButtonProps extends Omit<ButtonProps, "onClick"> {
  description: string;
  upgradeProductId: string;
  upgradeLabel: string;
  actionMarker?: string;
  successPath?: string;
}

function buildSuccessPath(actionMarker?: string): string {
  if (typeof window === "undefined") return "/";
  const path = `${window.location.pathname}${window.location.search}`;
  if (!actionMarker) return path;
  const url = new URL(path, window.location.origin);
  url.searchParams.set("paywall_action", actionMarker);
  return `${url.pathname}${url.search}`;
}

export function LockedFeatureButton({
  description,
  upgradeProductId,
  upgradeLabel,
  actionMarker,
  successPath,
  children,
  className,
  ...props
}: LockedFeatureButtonProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const checkoutSuccessPath = useMemo(
    () => successPath ?? buildSuccessPath(actionMarker),
    [actionMarker, successPath],
  );

  return (
    <>
      <Button
        variant="outline"
        className={className}
        onClick={() => setIsDialogOpen(true)}
        {...props}
      >
        <RiLockLine className="h-4 w-4" />
        {children}
      </Button>
      <PaywallDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        description={description}
        upgradeProductId={upgradeProductId}
        upgradeLabel={upgradeLabel}
        successPath={checkoutSuccessPath}
      />
    </>
  );
}
