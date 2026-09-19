import * as React from "react";

import { AccessLevelPicker } from "@/components/access/AccessLevelPicker";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useAccountAccessDefault,
  useSetAccountAccessDefault,
} from "@/hooks/useAccessPolicy";
import type { RecordingAccessLevel } from "@/types/access-policy";

const UPDATE_ERROR =
  "Couldn't update the default. Your previous setting is still active. Try again.";

interface PrivacyAccessSettingsProps {
  showHeader?: boolean;
}

function AccessDefaultSkeleton() {
  return (
    <div
      className="space-y-2"
      aria-label="Loading default access setting"
      aria-busy="true"
    >
      <Skeleton className="h-5 w-56" />
      <Skeleton className="h-4 w-full max-w-xl" />
      {Array.from({ length: 6 }, (_, index) => (
        <Skeleton key={index} className="h-20 w-full" />
      ))}
    </div>
  );
}

export function PrivacyAccessSettings({
  showHeader = true,
}: PrivacyAccessSettingsProps) {
  const accountDefault = useAccountAccessDefault();
  const updateDefault = useSetAccountAccessDefault();
  const [selectedLevel, setSelectedLevel] =
    React.useState<RecordingAccessLevel | null>(
      accountDefault.data?.accessLevel ?? null,
    );
  const [publicDialogOpen, setPublicDialogOpen] = React.useState(false);
  const [inlineError, setInlineError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (accountDefault.data?.accessLevel && !updateDefault.isPending) {
      setSelectedLevel(accountDefault.data.accessLevel);
    }
  }, [accountDefault.data?.accessLevel, updateDefault.isPending]);

  const restorePublicFocus = React.useCallback(() => {
    window.setTimeout(() => {
      document.getElementById("account-default-public")?.focus();
    }, 0);
  }, []);

  const saveLevel = React.useCallback(
    (nextLevel: RecordingAccessLevel) => {
      const previousLevel =
        selectedLevel ?? accountDefault.data?.accessLevel ?? "private";
      setInlineError(null);
      setSelectedLevel(nextLevel);
      updateDefault.mutate(nextLevel, {
        onError: () => {
          setSelectedLevel(previousLevel);
          setInlineError(UPDATE_ERROR);
        },
        onSuccess: () => {
          setInlineError(null);
        },
      });
    },
    [accountDefault.data?.accessLevel, selectedLevel, updateDefault],
  );

  const handleLevelChange = React.useCallback(
    (nextLevel: RecordingAccessLevel) => {
      if (nextLevel === selectedLevel) return;
      if (nextLevel === "public") {
        setPublicDialogOpen(true);
        return;
      }
      saveLevel(nextLevel);
    },
    [saveLevel, selectedLevel],
  );

  const handleDialogChange = React.useCallback(
    (open: boolean) => {
      setPublicDialogOpen(open);
      if (!open) restorePublicFocus();
    },
    [restorePublicFocus],
  );

  const confirmPublic = React.useCallback(() => {
    saveLevel("public");
    setPublicDialogOpen(false);
  }, [saveLevel]);

  return (
    <div className="space-y-8">
      {showHeader ? (
        <div className="space-y-1">
          <h1 className="font-montserrat text-base font-semibold text-foreground">
            Privacy &amp; Access
          </h1>
          <p className="text-sm text-muted-foreground">
            Choose how new recordings start.
          </p>
        </div>
      ) : null}

      <section className="space-y-4">
        <p className="text-sm text-muted-foreground">
          New recordings use this access level. Changing it won't update
          recordings you already have.
        </p>

        {accountDefault.isLoading || selectedLevel === null ? (
          <AccessDefaultSkeleton />
        ) : accountDefault.isError ? (
          <div className="space-y-4" role="alert">
            <p className="text-sm text-destructive">
              Couldn't load your default access setting. Try again.
            </p>
            <Button
              type="button"
              variant="hollow"
              onClick={() => accountDefault.refetch()}
            >
              Retry
            </Button>
          </div>
        ) : (
          <>
            <AccessLevelPicker
              id="account-default"
              label="Default access for new recordings"
              value={selectedLevel}
              onValueChange={handleLevelChange}
              disabled={updateDefault.isPending}
              pendingValue={
                updateDefault.isPending ? updateDefault.variables : undefined
              }
            />
            {inlineError ? (
              <p role="alert" className="text-sm text-destructive">
                {inlineError}
              </p>
            ) : null}
          </>
        )}
      </section>

      <AlertDialog open={publicDialogOpen} onOpenChange={handleDialogChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Make new recordings public by default?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Every new recording will be publicly viewable unless you change
              its access level. Existing recordings will not change.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep current default</AlertDialogCancel>
            <AlertDialogAction onClick={confirmPublic}>
              Use Public by default
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default PrivacyAccessSettings;
