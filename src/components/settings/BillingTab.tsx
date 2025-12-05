import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RiBankCardLine, RiSparkling2Line } from "@remixicon/react";

export default function BillingTab() {
  return (
    <div>
      {/* Top separator for breathing room */}
      <Separator className="mb-12" />

      {/* Current Plan Section */}
      <div className="grid grid-cols-1 gap-x-10 gap-y-8 lg:grid-cols-3">
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-gray-50">
            Current Plan
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">
            Your subscription and billing information
          </p>
        </div>
        <div className="lg:col-span-2">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
              <RiBankCardLine className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-lg font-semibold">Free Plan</h3>
                <Badge variant="outline">Active</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                You're currently on the Free plan with unlimited access to core features.
              </p>
            </div>
          </div>
        </div>
      </div>

      <Separator className="my-16" />

      {/* Pro Plan Coming Soon */}
      <div className="grid grid-cols-1 gap-x-10 gap-y-8 lg:grid-cols-3">
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-gray-50">
            PRO Plan
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">
            Advanced features for power users
          </p>
        </div>
        <div className="lg:col-span-2">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-vibe-orange/20 to-vibe-orange/10 flex items-center justify-center">
              <RiSparkling2Line className="h-6 w-6 text-vibe-orange" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-lg font-semibold">PRO Features</h3>
                <Badge variant="outline">Coming Soon</Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Advanced analytics, custom integrations, priority support, and more.
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Advanced AI insights and sentiment analysis
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Custom CRM integrations
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Team collaboration features
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Priority support
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
