import React, { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { RiUserLine } from '@remixicon/react';

interface WrongAccountStateProps {
  recipientMasked: string | null;
  onSignOut: () => void;
  onCancel: () => void;
  isSigningOut: boolean;
}

/**
 * WrongAccountState
 *
 * Shown when an authenticated visitor's email differs from the share-link
 * recipient. Surfaces the masked recipient email and a one-click sign-out
 * path to switch accounts.
 *
 * Phase 32 — see .planning/phases/32-shared-call-public-landing-page/32-UI-SPEC.md
 */
export const WrongAccountState: React.FC<WrongAccountStateProps> = ({
  recipientMasked,
  onSignOut,
  onCancel,
  isSigningOut,
}) => {
  const signOutRef = useRef<HTMLButtonElement>(null);

  // Auto-focus the primary action on mount per UI-SPEC accessibility contract.
  useEffect(() => {
    signOutRef.current?.focus();
  }, []);

  const bodyCopy = recipientMasked
    ? `This call was shared with ${recipientMasked}. Sign out and sign back in with that account.`
    : 'This call was shared with a different email. Sign out and sign back in with that account.';

  return (
    <div className="min-h-screen flex items-center justify-center bg-viewport p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-sm"
      >
        <div className="rounded-2xl border border-border bg-card shadow-lg px-8 py-10">
          <div className="flex flex-col items-center mb-6">
            <RiUserLine
              className="h-8 w-8 text-muted-foreground mb-3"
              aria-hidden="true"
            />
            <h1 className="text-xl font-semibold text-foreground text-center mb-2">
              This share is for a different account
            </h1>
            <p className="text-sm text-muted-foreground text-center">{bodyCopy}</p>
          </div>

          <div className="space-y-2">
            <Button
              ref={signOutRef}
              type="button"
              className="w-full h-10 text-sm font-medium bg-foreground text-background hover:bg-foreground/90"
              onClick={onSignOut}
              disabled={isSigningOut}
            >
              {isSigningOut ? 'Signing out...' : 'Sign out'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full h-10 text-sm font-medium"
              onClick={onCancel}
              disabled={isSigningOut}
            >
              Cancel
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default WrongAccountState;
