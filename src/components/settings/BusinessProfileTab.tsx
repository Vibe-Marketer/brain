/**
 * Business Profile Tab
 *
 * Settings tab for managing business profiles.
 * Supports up to 3 profiles with one default.
 * Provides profile selector with create/delete functionality.
 */

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  RiAddLine,
  RiDeleteBin6Line,
  RiLoader2Line,
  RiStarLine,
  RiStarFill,
  RiBuilding4Line,
} from '@remixicon/react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { BusinessProfileForm } from './BusinessProfileForm';
import {
  useBusinessProfileStore,
  useProfiles,
  useProfilesLoading,
  useProfilesError,
} from '@/stores/businessProfileStore';
import { calculateProfileCompletion } from '@/types/content-hub';
import type { BusinessProfile } from '@/types/content-hub';

export default function BusinessProfileTab() {
  const profiles = useProfiles();
  const loading = useProfilesLoading();
  const error = useProfilesError();

  const fetchProfiles = useBusinessProfileStore((state) => state.fetchProfiles);
  const createProfile = useBusinessProfileStore((state) => state.createProfile);
  const updateProfile = useBusinessProfileStore((state) => state.updateProfile);
  const deleteProfile = useBusinessProfileStore((state) => state.deleteProfile);
  const setAsDefault = useBusinessProfileStore((state) => state.setAsDefault);

  // Local state for selected profile
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load profiles on mount
  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  // Select default or first profile when profiles load
  useEffect(() => {
    if (profiles.length > 0 && !selectedProfileId) {
      const defaultProfile = profiles.find((p) => p.is_default);
      setSelectedProfileId(defaultProfile?.id || profiles[0].id);
    }
  }, [profiles, selectedProfileId]);

  // Handle profile creation
  const handleCreateProfile = async () => {
    if (profiles.length >= 3) {
      toast.error('Maximum of 3 profiles allowed');
      return;
    }

    setIsCreating(true);
    const newProfile = await createProfile({
      company_name: `New Profile ${profiles.length + 1}`,
      is_default: profiles.length === 0,
    });

    if (newProfile) {
      setSelectedProfileId(newProfile.id);
      toast.success('Profile created');
    }
    setIsCreating(false);
  };

  // Handle profile deletion
  const handleDeleteProfile = async (profileId: string) => {
    setIsDeleting(true);
    const success = await deleteProfile(profileId);

    if (success) {
      // Select another profile or null
      const remaining = profiles.filter((p) => p.id !== profileId);
      if (remaining.length > 0) {
        setSelectedProfileId(remaining[0].id);
      } else {
        setSelectedProfileId(null);
      }
      toast.success('Profile deleted');
    }
    setIsDeleting(false);
  };

  // Handle set as default
  const handleSetDefault = async (profileId: string) => {
    const result = await setAsDefault(profileId);
    if (result) {
      toast.success('Default profile updated');
    }
  };

  // Get selected profile
  const selectedProfile = profiles.find((p) => p.id === selectedProfileId);

  // Loading state
  if (loading && profiles.length === 0) {
    return (
      <div>
        <Separator className="mb-12" />
        <div className="grid grid-cols-1 gap-x-10 gap-y-8 lg:grid-cols-3">
          <div>
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-48 mt-2" />
          </div>
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div>
        <Separator className="mb-12" />
        <div className="text-center py-12">
          <p className="text-destructive mb-4">Failed to load profiles</p>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <Button onClick={() => fetchProfiles()}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Top separator for breathing room */}
      <Separator className="mb-12" />

      {/* Profile Selector Section */}
      <div className="grid grid-cols-1 gap-x-10 gap-y-8 lg:grid-cols-3">
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-gray-50">Business Profile</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">
            Create profiles to personalize AI-generated content for different businesses or brands.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            You can have up to 3 profiles.
          </p>
        </div>
        <div className="lg:col-span-2">
          <div className="flex items-center gap-4">
            {/* Profile Selector */}
            {profiles.length > 0 && (
              <div className="flex-1 max-w-xs">
                <Select
                  value={selectedProfileId || undefined}
                  onValueChange={setSelectedProfileId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a profile..." />
                  </SelectTrigger>
                  <SelectContent>
                    {profiles.map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        <div className="flex items-center gap-2">
                          {profile.is_default && (
                            <RiStarFill className="h-3 w-3 text-vibe-orange" />
                          )}
                          <span>{profile.company_name || 'Untitled Profile'}</span>
                          <span className="text-xs text-muted-foreground ml-1">
                            ({calculateProfileCompletion(profile)}%)
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Create Button */}
            <Button
              variant="hollow"
              size="sm"
              onClick={handleCreateProfile}
              disabled={isCreating || profiles.length >= 3}
            >
              {isCreating ? (
                <RiLoader2Line className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RiAddLine className="h-4 w-4 mr-2" />
              )}
              New Profile
            </Button>
          </div>

          {/* Selected Profile Actions */}
          {selectedProfile && (
            <div className="flex items-center gap-4 mt-4">
              {/* Set as Default */}
              {!selectedProfile.is_default && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSetDefault(selectedProfile.id)}
                  className="text-muted-foreground"
                >
                  <RiStarLine className="h-4 w-4 mr-2" />
                  Set as Default
                </Button>
              )}
              {selectedProfile.is_default && (
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  <RiStarFill className="h-4 w-4 text-vibe-orange" />
                  Default Profile
                </span>
              )}

              {/* Delete Button */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    disabled={isDeleting}
                  >
                    {isDeleting ? (
                      <RiLoader2Line className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <RiDeleteBin6Line className="h-4 w-4 mr-2" />
                    )}
                    Delete Profile
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Profile</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete "{selectedProfile.company_name || 'this profile'}"?
                      This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => handleDeleteProfile(selectedProfile.id)}
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>
      </div>

      <Separator className="my-12" />

      {/* Profile Form or Empty State */}
      {selectedProfile ? (
        <BusinessProfileForm
          profile={selectedProfile}
          onUpdate={updateProfile}
        />
      ) : profiles.length === 0 ? (
        <div className="text-center py-16">
          <RiBuilding4Line className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No Business Profiles</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
            Create a business profile to personalize your AI-generated content.
            Your profile helps the AI understand your brand voice, target audience, and offerings.
          </p>
          <Button onClick={handleCreateProfile} disabled={isCreating}>
            {isCreating ? (
              <RiLoader2Line className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RiAddLine className="h-4 w-4 mr-2" />
            )}
            Create Your First Profile
          </Button>
        </div>
      ) : null}
    </div>
  );
}
