import { RiKeyLine, RiFlashlightLine } from "@remixicon/react";
import { StepCard } from "./StepCard";

export function WelcomeStep() {
  return (
    <div className="space-y-6">
      <p className="text-muted-foreground font-medium">
        Two connections required:
      </p>
      <div className="grid gap-3">
        {/* API Key + Webhook Card */}
        <StepCard
          icon={<RiKeyLine className="h-5 w-5" />}
          title="API Key + Webhook"
          description="Import your past meetings"
        />
        {/* OAuth Connection Card */}
        <StepCard
          icon={<RiFlashlightLine className="h-5 w-5" />}
          title="OAuth Connection"
          description="Auto-sync new meetings going forward"
        />
      </div>

      <p className="text-sm text-muted-foreground">
        Just 4 quick steps, 5 minutes total.
      </p>
    </div>
  );
}
