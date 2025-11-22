import { Button } from "@/components/ui/button";
import { RiCheckboxBlankCircleLine, RiLoader4Line, RiFlashlightLine } from "@remixicon/react";

interface OAuthStepProps {
  oauthConnecting: boolean;
  onOAuthConnect: () => void;
}

export function OAuthStep({ oauthConnecting, onOAuthConnect }: OAuthStepProps) {
  return (
    <div className="space-y-6">
      {/* Progress checklist with checkmarks */}
      <ul className="space-y-2 text-sm">
        <li className="flex items-center gap-3">
          <span className="text-lg">✓</span>
          <span>API credentials saved</span>
        </li>
        <li className="flex items-center gap-3">
          <span className="text-lg">✓</span>
          <span>Webhook configured</span>
        </li>
        <li className="flex items-center gap-3">
          <span className="text-lg">✓</span>
          <span>Scopes confirmed</span>
        </li>
        <li className="flex items-center gap-3">
          <RiCheckboxBlankCircleLine className="h-5 w-5 text-muted-foreground shrink-0" />
          <span>OAuth connection</span>
        </li>
      </ul>

      <p className="text-sm text-muted-foreground">
        The API imported your past meetings. Now authorize OAuth so new meetings sync automatically.
      </p>

      {/* Primary OAuth Button - larger */}
      <div className="flex justify-center py-4">
        <Button
          onClick={onOAuthConnect}
          disabled={oauthConnecting}
          size="lg"
          className="px-10 py-6 text-base"
        >
          {oauthConnecting ? (
            <>
              <RiLoader4Line className="mr-2 h-5 w-5 animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <RiFlashlightLine className="mr-2 h-5 w-5" />
              Connect with Fathom OAuth
            </>
          )}
        </Button>
      </div>

      <p className="text-sm text-muted-foreground text-center">
        You'll sign into Fathom, authorize Conversion Brain, then land back here.
      </p>
    </div>
  );
}
