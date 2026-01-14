/**
 * Select Sources Step
 *
 * Step 1 of the Social Post Generator wizard.
 * Allows users to select call transcripts and a business profile.
 */

import { useEffect, useState, useMemo } from 'react';
import { RiPhoneLine, RiBriefcaseLine, RiCheckLine, RiLoader4Line, RiEditLine } from '@remixicon/react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useContentWizardStore, useSelectedCalls, useSelectedProfile } from '@/stores/contentWizardStore';
import { useBusinessProfileStore, useProfiles, useDefaultProfile } from '@/stores/businessProfileStore';
import { supabase } from '@/integrations/supabase/client';
import { BusinessProfileDialog } from '@/components/settings/BusinessProfileDialog';

interface FathomCall {
  recording_id: number;
  title: string | null;
  created_at: string | null;
  recording_start_time: string | null;
  recording_end_time: string | null;
}

export function SelectSourcesStep() {
  const selectedCalls = useSelectedCalls();
  const selectedProfileId = useSelectedProfile();
  const profiles = useProfiles();
  const defaultProfile = useDefaultProfile();

  const toggleCall = useContentWizardStore((state) => state.toggleCall);
  const setSelectedProfile = useContentWizardStore((state) => state.setSelectedProfile);
  const fetchProfiles = useBusinessProfileStore((state) => state.fetchProfiles);

  const [searchTerm, setSearchTerm] = useState('');
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);

  // Get the currently selected profile object
  const selectedProfile = profiles.find((p) => p.id === selectedProfileId);

  // Fetch profiles on mount
  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  // Set default profile if none selected
  useEffect(() => {
    if (!selectedProfileId && defaultProfile) {
      setSelectedProfile(defaultProfile.id);
    }
  }, [selectedProfileId, defaultProfile, setSelectedProfile]);

  // Fetch real fathom_calls data
  const { data: calls = [], isLoading } = useQuery({
    queryKey: ['content-wizard-calls', searchTerm],
    queryFn: async () => {
      let query = supabase
        .from('fathom_calls')
        .select('recording_id, title, created_at, recording_start_time, recording_end_time')
        .order('created_at', { ascending: false })
        .limit(50);

      // Apply search filter if provided
      if (searchTerm) {
        query = query.or(`title.ilike.%${searchTerm}%,summary.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as FathomCall[];
    },
  });

  // Format date for display
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Unknown date';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Calculate and format duration from start/end times
  const formatDuration = (startTime: string | null, endTime: string | null) => {
    if (!startTime || !endTime) return '';
    const start = new Date(startTime);
    const end = new Date(endTime);
    const diffMs = end.getTime() - start.getTime();
    if (diffMs <= 0) return '';
    const minutes = Math.round(diffMs / 60000);
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Profile Selection */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <RiBriefcaseLine className="w-5 h-5 text-muted-foreground" />
          <h3 className="font-medium">Business Profile</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Select a business profile to personalize your generated content.
        </p>

        {profiles.length === 0 ? (
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <p className="text-sm text-amber-700 dark:text-amber-300">
              No business profiles found. Create one in Settings to get personalized content.
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Select
              value={selectedProfileId || ''}
              onValueChange={(value) => setSelectedProfile(value)}
            >
              <SelectTrigger className="w-full max-w-md">
                <SelectValue placeholder="Select a profile" />
              </SelectTrigger>
              <SelectContent>
                {profiles.map((profile) => (
                  <SelectItem key={profile.id} value={profile.id}>
                    {profile.company_name || 'Unnamed Profile'}
                    {profile.is_default && ' (Default)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedProfile && (
              <Button
                variant="hollow"
                size="sm"
                onClick={() => setIsProfileDialogOpen(true)}
                className="flex items-center gap-2"
              >
                <RiEditLine className="h-4 w-4" />
                Edit Profile
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Call Selection */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <RiPhoneLine className="w-5 h-5 text-muted-foreground" />
          <h3 className="font-medium">Call Transcripts</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Select one or more calls to extract insights from.
          {selectedCalls.length > 0 && (
            <span className="ml-2 text-vibe-orange font-medium">
              ({selectedCalls.length} selected)
            </span>
          )}
        </p>

        <Input
          placeholder="Search calls..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-md"
        />

        <div className="space-y-2 max-h-[400px] overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center p-8 text-muted-foreground">
              <RiLoader4Line className="w-5 h-5 animate-spin mr-2" />
              Loading calls...
            </div>
          ) : calls.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              {searchTerm ? 'No calls match your search.' : 'No calls found.'}
            </div>
          ) : (
            calls.map((call) => {
              const isSelected = selectedCalls.includes(call.recording_id);
              return (
                <button
                  key={call.recording_id}
                  type="button"
                  onClick={() => toggleCall(call.recording_id)}
                  className={cn(
                    'w-full flex items-center gap-3 p-4 rounded-lg border text-left transition-colors',
                    isSelected
                      ? 'border-vibe-orange bg-orange-50 dark:bg-orange-950/20'
                      : 'border-border hover:border-vibe-orange/50'
                  )}
                >
                  <div
                    className={cn(
                      'flex items-center justify-center w-5 h-5 rounded border-2 transition-colors',
                      isSelected
                        ? 'bg-vibe-orange border-vibe-orange'
                        : 'border-muted-foreground'
                    )}
                  >
                    {isSelected && <RiCheckLine className="w-3 h-3 text-white" />}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{call.title || 'Untitled Call'}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(call.created_at)}
                      {call.recording_start_time && call.recording_end_time &&
                        ` · ${formatDuration(call.recording_start_time, call.recording_end_time)}`}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Validation Message */}
      {selectedCalls.length === 0 && (
        <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-4">
          Select at least one call transcript to continue.
        </div>
      )}

      {/* Profile Edit Dialog */}
      {selectedProfile && (
        <BusinessProfileDialog
          open={isProfileDialogOpen}
          onOpenChange={setIsProfileDialogOpen}
          profile={selectedProfile}
        />
      )}
    </div>
  );
}
