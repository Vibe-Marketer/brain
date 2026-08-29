/**
 * ClosureGateBanner (GSD b36e673c) — plain-English readout of the falsifiable
 * closure gate for a resolved ticket: verified / pending / failed / unverified.
 * Informational only — it never blocks the status Select. A human can still
 * close a ticket automation can't verify; this just stops "resolved" from
 * reading as more certain than the evidence supports.
 */
import {
  RiAlertLine,
  RiCheckboxCircleLine,
  RiQuestionLine,
  RiTimeLine,
} from "@remixicon/react";
import type { ClosureGateResult, ClosureGateVerdict } from "@/lib/ticket-closure-gate";

const VERDICT_META: Record<
  ClosureGateVerdict,
  { icon: typeof RiCheckboxCircleLine; label: string; className: string }
> = {
  verified: {
    icon: RiCheckboxCircleLine,
    label: "Closure verified",
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  pending: {
    icon: RiTimeLine,
    label: "Closure pending observation",
    className: "border-vibe-orange/30 bg-vibe-orange/10 text-vibe-orange",
  },
  failed: {
    icon: RiAlertLine,
    label: "Closure gate failed",
    className: "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400",
  },
  unverified: {
    icon: RiQuestionLine,
    label: "No automated verification",
    className: "border-border bg-muted/50 text-muted-foreground",
  },
};

export function ClosureGateBanner({ result }: { result: ClosureGateResult }) {
  const meta = VERDICT_META[result.verdict];
  const Icon = meta.icon;

  return (
    <div className={`space-y-1 rounded-lg border p-3 text-xs ${meta.className}`}>
      <div className="flex items-center gap-2 font-semibold">
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
        {meta.label}
      </div>
      <ul className="list-disc space-y-0.5 pl-6 text-foreground/80">
        {result.reasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
    </div>
  );
}
