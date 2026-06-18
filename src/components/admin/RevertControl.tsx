/**
 * RevertControl (TKT-REVERT) — the auto-deploy world's answer to a bad fix.
 *
 * The autopilot now pushes fixes straight to main (auto-deploy), so there is no
 * approval step to catch a regression — the operator needs an UNDO instead. This
 * surfaces the deployed commit and a one-click `git revert <sha>` command. The
 * browser can't run git itself, so copying the exact, ready-to-run command is
 * the honest, always-correct action (no button that silently does nothing).
 *
 * Shown only when a ticket actually deployed a fix (a runner_run with a fix_sha).
 */
import { RiArrowGoBackLine, RiFileCopyLine } from "@remixicon/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface RevertControlProps {
  fixSha: string;
}

export function RevertControl({ fixSha }: RevertControlProps) {
  const command = `git revert ${fixSha}`;

  const copy = (value: string, label: string) => {
    navigator.clipboard
      .writeText(value)
      .then(() => toast.success(`${label} copied`))
      .catch(() => toast.error("Copy failed"));
  };

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <RiArrowGoBackLine className="h-4 w-4 text-vibe-orange" aria-hidden="true" />
        <h3 className="font-montserrat text-xs font-extrabold uppercase tracking-wide text-foreground">
          Undo this fix
        </h3>
      </div>
      <p className="text-xs text-muted-foreground">
        This fix is already live (it auto-deployed). If it caused a regression,
        revert the commit below — it ships the revert to production the same way.
      </p>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">Deployed commit</span>
        <span className="flex min-w-0 items-center gap-1">
          <code className="truncate tabular-nums">{fixSha.slice(0, 12)}</code>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 shrink-0 p-0"
            aria-label="Copy commit SHA"
            onClick={() => copy(fixSha, "Commit SHA")}
          >
            <RiFileCopyLine className="h-3.5 w-3.5" />
          </Button>
        </span>
      </div>
      <div className="flex items-center justify-between gap-2 rounded bg-muted p-2">
        <code className="truncate text-xs">{command}</code>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 shrink-0 p-0"
          aria-label="Copy revert command"
          onClick={() => copy(command, "Revert command")}
        >
          <RiFileCopyLine className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
