import React from 'react';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { RiLinksLine, RiArrowRightLine } from '@remixicon/react';

interface PublicShareLandingProps {
  inviterName: string;
  callTitle: string;
  token: string;
  onSignUp: () => void;
  onOpenExisting: () => void;
}

/**
 * PublicShareLanding
 *
 * Loom-style landing card shown to unauthenticated visitors at /s/:token.
 * Identifies the inviter and call, offers two clear paths: Free-tier signup
 * (locked to the share-recipient email) or sign-in with an existing account.
 *
 * Phase 32 — see .planning/phases/32-shared-call-public-landing-page/32-UI-SPEC.md
 */
export const PublicShareLanding: React.FC<PublicShareLandingProps> = ({
  inviterName,
  callTitle,
  onSignUp,
  onOpenExisting,
}) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-viewport p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-md"
      >
        <div className="rounded-2xl border border-border bg-card shadow-lg px-8 py-10">
          <div className="flex flex-col items-center mb-6">
            <img
              src="/cv-play-button.svg"
              alt="CallVault"
              className="h-12 w-auto mb-4"
            />
            <RiLinksLine
              className="h-8 w-8 text-muted-foreground mb-3"
              aria-hidden="true"
            />
            <h1 className="text-xl font-semibold text-foreground text-center mb-2">
              {inviterName} shared a call with you
            </h1>
            <p className="text-sm text-muted-foreground text-center line-clamp-2">
              {callTitle}
            </p>
          </div>

          <div className="space-y-2">
            <Button
              type="button"
              className="w-full h-10 text-sm font-medium bg-foreground text-background hover:bg-foreground/90"
              onClick={onSignUp}
            >
              Sign up to view
              <RiArrowRightLine
                className="ml-2 h-4 w-4 text-vibe-orange"
                aria-hidden="true"
              />
            </Button>
            <Button
              type="button"
              variant="hollow"
              className="w-full h-10 text-sm font-medium"
              onClick={onOpenExisting}
            >
              Open in existing account
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center mt-4">
            Free tier — no credit card needed
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default PublicShareLanding;
