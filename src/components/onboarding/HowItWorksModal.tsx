/**
 * HowItWorksModal — Interactive 6-card explainer of the CallVault data model.
 *
 * Explains: Organizations → Workspaces → Folders → Calls → Members → Sharing → Exports
 *
 * Exports:
 *   HowItWorksContent  — inner content only (no Dialog wrapper), for embedding in OnboardingModal
 *   HowItWorksModal    — standalone dialog wrapper, for triggering from the sidebar
 *
 * @pattern dialog-wizard
 */

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  RiLayoutGridLine,
  RiBriefcaseLine,
  RiFolderLine,
  RiTeamLine,
  RiShareLine,
  RiDownload2Line,
  RiBuilding2Line,
  RiMicLine,
  RiArrowRightLine,
  RiCheckLine,
} from "@remixicon/react";
import { cn } from "@/lib/utils";

/* ─────────────────────────── Types ─────────────────────────────────────── */

interface HowItWorksModalProps {
  /** Called when user completes or skips */
  onComplete: () => void;
  /** Optional: show a Back button to return to previous onboarding step */
  onBack?: () => void;
  /** For standalone Dialog usage */
  open?: boolean;
}

/* ─────────────────────────── Progress dots ─────────────────────────────── */

const TOTAL_CARDS = 6;

function ProgressDots({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-1.5">
      {Array.from({ length: TOTAL_CARDS }, (_, i) => (
        <motion.div
          key={i}
          animate={{
            width: i === current ? 20 : 6,
            backgroundColor:
              i === current
                ? "hsl(var(--vibe-orange))"
                : i < current
                  ? "hsl(var(--vibe-orange) / 0.4)"
                  : "hsl(var(--muted-foreground) / 0.22)",
          }}
          transition={{ duration: 0.22, ease: "easeInOut" }}
          className="h-1.5 rounded-full"
        />
      ))}
    </div>
  );
}

/* ─────────────────────────── Hierarchy tree ─────────────────────────────── */

type TreeLevel = "org" | "workspace" | "folder" | "call";

interface TreeNode {
  level: TreeLevel;
  label: string;
  sublabel?: string;
}

const TREE_NODES: TreeNode[] = [
  { level: "org", label: "Organization", sublabel: "Personal or Business" },
  { level: "workspace", label: "Workspace", sublabel: "My Calls · Team Workspace" },
  { level: "folder", label: "Folder", sublabel: "Group by project, client, quarter…" },
  { level: "call", label: "Call", sublabel: "Recording + Transcript + Summary" },
];

const TREE_ICON_CLASSES: Record<TreeLevel, string> = {
  org: "text-slate-500",
  workspace: "text-slate-500",
  folder: "text-amber-500",
  call: "text-rose-400",
};

function TreeIcon({ level }: { level: TreeLevel }) {
  const cls = cn("h-4 w-4 flex-shrink-0", TREE_ICON_CLASSES[level]);
  switch (level) {
    case "org":
      return <RiBuilding2Line className={cls} />;
    case "workspace":
      return <RiBriefcaseLine className={cls} />;
    case "folder":
      return <RiFolderLine className={cls} />;
    case "call":
      return <RiMicLine className={cls} />;
  }
}

/** Shows the first `visibleLevels` items of the hierarchy tree, animating new ones in */
function HierarchyTree({ visibleLevels }: { visibleLevels: number }) {
  return (
    <div className="mt-4 mb-1 flex flex-col gap-0">
      {TREE_NODES.slice(0, visibleLevels).map((node, i) => (
        <motion.div
          key={node.level}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, delay: i === visibleLevels - 1 ? 0.05 : 0, ease: "easeOut" }}
        >
          <div className="flex items-start gap-2" style={{ paddingLeft: `${i * 20}px` }}>
            {/* Connector line */}
            {i > 0 && (
              <div className="flex flex-col items-center self-stretch mr-0" style={{ marginLeft: -12, marginRight: 4 }}>
                <div className="w-px h-3 bg-border" />
                <div className="w-2 h-px bg-border mt-0" />
              </div>
            )}
            {i === 0 && <div className="w-4" />}
            <div
              className={cn(
                "flex items-center gap-2 px-2.5 py-1.5 rounded-lg border",
                "bg-white border-border/60 shadow-sm",
                i === visibleLevels - 1 && "ring-1 ring-vibe-orange/30 border-vibe-orange/30 bg-vibe-orange/[0.03]",
              )}
            >
              <TreeIcon level={node.level} />
              <div>
                <span className="text-xs font-semibold text-slate-800">{node.label}</span>
                {node.sublabel && (
                  <span className="text-[11px] text-slate-400 ml-1.5">{node.sublabel}</span>
                )}
              </div>
            </div>
          </div>
          {i < visibleLevels - 1 && (
            <div style={{ paddingLeft: `${i * 20 + 20}px` }} className="h-3 flex">
              <div className="w-px bg-border ml-[18px]" />
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
}

/* ─────────────────────────── Icon illustration (cards 4-6) ─────────────── */

function CardIllustration({ icon: Icon, color }: { icon: React.ComponentType<{ className?: string }>; color: string }) {
  return (
    <div className="flex items-center justify-center mt-3 mb-2">
      <div className={cn("relative flex items-center justify-center")}>
        <div className={cn("absolute h-16 w-16 rounded-full opacity-10 blur-sm", color)} />
        <div className={cn(
          "relative h-12 w-12 rounded-2xl flex items-center justify-center border shadow-sm",
          "bg-vibe-orange/10 border-vibe-orange/20",
        )}>
          <Icon className="h-6 w-6 text-vibe-orange" />
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── Card data ─────────────────────────────────── */

interface CardDef {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: React.ReactNode;
  /** How many hierarchy levels to show (1-4). undefined = don't show tree */
  treeLevels?: number;
}

const CARDS: CardDef[] = [
  {
    icon: RiLayoutGridLine,
    title: "Everything starts with an Organization",
    body: (
      <p className="text-sm text-slate-500 leading-relaxed">
        CallVault organizes your calls into a simple hierarchy. You get a{" "}
        <strong className="text-slate-700 font-semibold">Personal</strong> organization automatically
        — create <strong className="text-slate-700 font-semibold">Business</strong> organizations to
        collaborate with your team.
      </p>
    ),
    treeLevels: 1,
  },
  {
    icon: RiBriefcaseLine,
    title: "Workspaces hold your calls",
    body: (
      <p className="text-sm text-slate-500 leading-relaxed">
        Every organization has workspaces. Your{" "}
        <strong className="text-slate-700 font-semibold">My Calls</strong> workspace is created
        automatically — all synced and uploaded calls land here by default. Create team workspaces to
        share calls with specific people.
      </p>
    ),
    treeLevels: 2,
  },
  {
    icon: RiFolderLine,
    title: "Folders keep things organized",
    body: (
      <p className="text-sm text-slate-500 leading-relaxed">
        Inside each workspace, use folders to group calls — by client, project, quarter, or however
        you think. Archived folders stay searchable but hidden from the main view.
      </p>
    ),
    treeLevels: 4,
  },
  {
    icon: RiTeamLine,
    title: "Invite your team",
    body: (
      <div className="space-y-2.5">
        <p className="text-sm text-slate-500 leading-relaxed">
          Invite teammates to your Business organization from{" "}
          <strong className="text-slate-700 font-semibold">Settings → Organizations</strong>. Once
          they're in the org, add them to specific workspaces and set their role:
        </p>
        <div className="space-y-1.5 pl-1">
          {[
            { role: "Viewer", desc: "can read calls and transcripts" },
            { role: "Editor", desc: "can tag, folder, and annotate" },
            { role: "Admin", desc: "full workspace management" },
          ].map(({ role, desc }) => (
            <div key={role} className="flex items-baseline gap-2 text-sm">
              <span className="font-semibold text-slate-700 w-14 flex-shrink-0">{role}</span>
              <span className="text-slate-500">{desc}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    icon: RiShareLine,
    title: "Share calls with anyone",
    body: (
      <div className="space-y-2">
        <p className="text-sm text-slate-500 leading-relaxed">
          Share any call via a link — with or without an expiry date. The recipient{" "}
          <strong className="text-slate-700 font-semibold">doesn't need a CallVault account</strong>.
          Great for sharing highlights with clients or stakeholders.
        </p>
        <p className="text-xs text-slate-400 mt-1">
          Right-click a call → Share, or use the share button in the call detail view.
        </p>
      </div>
    ),
  },
  {
    icon: RiDownload2Line,
    title: "Export in any format",
    body: (
      <p className="text-sm text-slate-500 leading-relaxed">
        Download transcripts as{" "}
        <strong className="text-slate-700 font-semibold">PDF, Word, Markdown, or CSV</strong>.
        Export multiple calls at once from the toolbar. Everything stays yours — no lock-in.
      </p>
    ),
  },
];

/* ─────────────────────────── HowItWorksContent ─────────────────────────── */

export function HowItWorksContent({ onComplete, onBack }: Omit<HowItWorksModalProps, "open">) {
  const [card, setCard] = useState(0);

  const isFirst = card === 0;
  const isLast = card === TOTAL_CARDS - 1;

  const current = CARDS[card];

  return (
    <div className="flex flex-col">
      {/* Progress dots */}
      <ProgressDots current={card} />

      {/* Card content */}
      <div className="relative min-h-[320px] mt-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={card}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="flex flex-col"
          >
            {/* Icon + Title */}
            {current.treeLevels == null && (
              <CardIllustration icon={current.icon} color="bg-vibe-orange" />
            )}

            <div className={cn("flex items-center gap-2.5", current.treeLevels != null ? "mt-1 mb-3" : "mb-3")}>
              <div className="shrink-0 h-8 w-8 rounded-lg bg-vibe-orange/10 flex items-center justify-center">
                <current.icon className="h-4 w-4 text-vibe-orange" />
              </div>
              <h3 className="text-base font-bold text-slate-900 leading-snug">{current.title}</h3>
            </div>

            {/* Body */}
            <div>{current.body}</div>

            {/* Hierarchy tree (cards 1-3) */}
            {current.treeLevels != null && (
              <HierarchyTree visibleLevels={current.treeLevels} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className="mt-5 flex items-center justify-between gap-2">
        {/* Left: Skip or Back */}
        <div className="flex items-center gap-3">
          {!isFirst && (
            <button
              type="button"
              onClick={() => setCard((c) => c - 1)}
              className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
            >
              Back
            </button>
          )}
          {isFirst && onBack && (
            <button
              type="button"
              onClick={onBack}
              className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
            >
              Back
            </button>
          )}
          <button
            type="button"
            onClick={onComplete}
            className="text-xs text-slate-400 hover:text-slate-600 transition-colors underline-offset-4 hover:underline"
          >
            Skip
          </button>
        </div>

        {/* Right: Next / Got it */}
        <Button
          className="bg-gradient-to-b from-orange-400 to-orange-600 border border-orange-600/70 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_1px_4px_rgba(255,136,0,0.3)] hover:from-orange-500 hover:to-orange-700 active:translate-y-px active:scale-[0.98] transition-all rounded-xl h-9 px-5 text-sm font-semibold"
          onClick={() => {
            if (isLast) {
              onComplete();
            } else {
              setCard((c) => c + 1);
            }
          }}
        >
          {isLast ? (
            <>
              Got it <RiCheckLine className="h-3.5 w-3.5 ml-1" />
            </>
          ) : (
            <>
              Next <RiArrowRightLine className="h-3.5 w-3.5 ml-1" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

/* ─────────────────────────── HowItWorksModal (standalone) ──────────────── */

export function HowItWorksModal({ onComplete, onBack, open }: HowItWorksModalProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onComplete(); }}>
      <DialogContent className="sm:max-w-lg overflow-hidden">
        {/* Hidden accessible title/description for Radix */}
        <DialogTitle className="sr-only">How CallVault works</DialogTitle>
        <DialogDescription className="sr-only">
          A 6-step interactive guide to the CallVault data model.
        </DialogDescription>

        <HowItWorksContent onComplete={onComplete} onBack={onBack} />
      </DialogContent>
    </Dialog>
  );
}

export default HowItWorksModal;
