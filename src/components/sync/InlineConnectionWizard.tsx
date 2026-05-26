import { RiCloseLine } from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { ConnectorSetupCluster } from "@/components/connectors/setup";
import type { IntegrationPlatform } from "@/lib/integration-platforms";

interface InlineConnectionWizardProps {
  platform: IntegrationPlatform;
  onComplete: () => void;
  onCancel: () => void;
  /** Kept for existing callers; connected account display now comes from ConnectorSetupCluster. */
  currentEmail?: string;
}

export function InlineConnectionWizard({
  platform,
  onComplete,
  onCancel,
  currentEmail: _currentEmail,
}: InlineConnectionWizardProps) {
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="h-8 w-8 p-0"
          aria-label="Close"
        >
          <RiCloseLine className="h-4 w-4" />
        </Button>
      </div>

      <ConnectorSetupCluster
        sourceApp={platform}
        mode="import"
        compact
        onConnected={onComplete}
        onSaved={onComplete}
      />
    </div>
  );
}
