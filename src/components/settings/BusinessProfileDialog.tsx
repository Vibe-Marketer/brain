/**
 * Business Profile Dialog
 *
 * Dialog for viewing/editing a business profile.
 * Used in contexts where the user needs quick access to profile editing.
 */

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { BusinessProfileForm } from './BusinessProfileForm';
import { useBusinessProfileStore } from '@/stores/businessProfileStore';
import type { BusinessProfile } from '@/types/content-hub';

interface BusinessProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: BusinessProfile;
}

export function BusinessProfileDialog({
  open,
  onOpenChange,
  profile,
}: BusinessProfileDialogProps) {
  const updateProfile = useBusinessProfileStore((state) => state.updateProfile);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-montserrat font-extrabold uppercase tracking-wide">
            {profile.company_name || 'Business Profile'}
          </DialogTitle>
          <DialogDescription>
            View and edit your business profile information. Changes are saved automatically.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4">
          <BusinessProfileForm
            profile={profile}
            onUpdate={updateProfile}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
