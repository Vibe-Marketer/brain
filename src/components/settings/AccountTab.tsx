import { useState, useEffect, useCallback, useRef } from "react";
import { useBlocker, useBeforeUnload } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  RiLoader2Line,
  RiEyeLine,
  RiEyeOffLine,
  RiUserLine,
  RiShieldLine,
  RiSettings3Line,
  RiPlugLine,
  RiAlertLine,
} from "@remixicon/react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { supabase } from "@/integrations/supabase/client";
import { getSafeUser } from "@/lib/auth-utils";
import { usePreferencesStore } from "@/stores/preferencesStore";

const timezones = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Anchorage", label: "Alaska Time (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HT)" },
  { value: "Europe/London", label: "London (GMT)" },
  { value: "Europe/Paris", label: "Paris (CET)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
  { value: "Asia/Shanghai", label: "Shanghai (CST)" },
  { value: "Australia/Sydney", label: "Sydney (AEDT)" },
];

interface SavedValues {
  displayName: string;
  timezone: string;
  hostEmail: string;
}

export default function AccountTab() {
  // Current form values (always editable)
  const [displayName, setDisplayName] = useState("");
  const [timezone, setTimezone] = useState("America/New_York");
  const [hostEmail, setHostEmail] = useState("");
  const [userEmail, setUserEmail] = useState("");

  // What's persisted in the DB — used to compute dirty state
  const savedValues = useRef<SavedValues>({
    displayName: "",
    timezone: "America/New_York",
    hostEmail: "",
  });

  const [isSaving, setIsSaving] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Password change (separate flow, unchanged)
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const { preferences, isLoading: prefsLoading, loadPreferences, updatePreference } = usePreferencesStore();

  // Dirty tracking
  const isDirty =
    isLoaded && (
      displayName !== savedValues.current.displayName ||
      timezone !== savedValues.current.timezone ||
      hostEmail !== savedValues.current.hostEmail
    );

  // Warn on browser tab close with unsaved changes
  useBeforeUnload(
    useCallback(
      (e: BeforeUnloadEvent) => {
        if (isDirty) {
          e.preventDefault();
        }
      },
      [isDirty],
    ),
  );

  // Block in-app navigation with unsaved changes
  const blocker = useBlocker(isDirty);

  useEffect(() => {
    loadProfileData();
    loadPreferences();
  }, []);

  const loadProfileData = async () => {
    try {
      const { user, error: authError } = await getSafeUser();
      if (authError || !user) return;

      setUserEmail(user.email || "");

      const { data: profileData } = await supabase
        .from("user_profiles")
        .select("display_name")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profileData?.display_name) {
        setDisplayName(profileData.display_name);
        savedValues.current.displayName = profileData.display_name;
      }

      const { data: settings } = await supabase
        .from("user_settings")
        .select("host_email")
        .eq("user_id", user.id)
        .maybeSingle();

      if (settings?.host_email) {
        setHostEmail(settings.host_email);
        savedValues.current.hostEmail = settings.host_email;
      }

      setIsLoaded(true);
    } catch (error) {
      logger.error("Error loading profile data", error);
      setIsLoaded(true);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const { user, error: authError } = await getSafeUser();
      if (authError || !user) return;

      const errors: string[] = [];

      // Save display name if changed
      if (displayName !== savedValues.current.displayName) {
        const { error } = await supabase
          .from("user_profiles")
          .update({ display_name: displayName })
          .eq("user_id", user.id);
        if (error) {
          errors.push("display name");
          logger.error("Error saving display name", error);
        } else {
          savedValues.current.displayName = displayName;
        }
      }

      // Save timezone if changed
      if (timezone !== savedValues.current.timezone) {
        // Save to user_settings table (future implementation)
        savedValues.current.timezone = timezone;
      }

      // Save host email if changed
      if (hostEmail !== savedValues.current.hostEmail) {
        const { error } = await supabase
          .from("user_settings")
          .update({ host_email: hostEmail })
          .eq("user_id", user.id);
        if (error) {
          errors.push("Fathom email");
          logger.error("Error saving host email", error);
        } else {
          savedValues.current.hostEmail = hostEmail;
        }
      }

      if (errors.length > 0) {
        toast.error(`Failed to update ${errors.join(", ")}`);
      } else {
        toast.success("Settings saved");
      }
    } catch (error) {
      logger.error("Error saving settings", error);
      toast.error("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && isDirty && !isSaving) {
      e.preventDefault();
      handleSave();
    }
  };

  const changePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    try {
      setChangingPassword(true);

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      setShowPasswordForm(false);
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password updated successfully");
    } catch (error) {
      logger.error("Error changing password", error);
      toast.error("Failed to update password");
    } finally {
      setChangingPassword(false);
    }
  };

  // Derive initials for avatar
  const initials = savedValues.current.displayName
    ? savedValues.current.displayName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : userEmail
    ? userEmail[0].toUpperCase()
    : "?";

  return (
    <div onKeyDown={handleKeyDown}>
      {/* Top separator for breathing room */}
      <Separator className="mb-12" />

      {/* ── 1. Profile ── */}
      <div className="grid grid-cols-1 gap-x-10 gap-y-8 lg:grid-cols-3">
        <div>
          <h2 className="flex items-center gap-2 font-montserrat font-extrabold uppercase tracking-wide text-sm text-foreground">
            <RiUserLine className="h-4 w-4 shrink-0" />
            Profile
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Your personal information and display settings
          </p>
        </div>
        <div className="lg:col-span-2 space-y-4">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center shrink-0">
              <span className="text-lg font-semibold text-foreground tabular-nums">{initials}</span>
            </div>
            <div className="space-y-0.5">
              <p className="text-sm font-medium text-foreground">{savedValues.current.displayName || "No display name set"}</p>
              <p className="text-xs text-muted-foreground">{userEmail}</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Display Name */}
            <div className="space-y-2">
              <Label htmlFor="display-name">Display Name</Label>
              <Input
                id="display-name"
                placeholder="Enter your display name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>

            {/* Email (read-only) */}
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={userEmail}
                readOnly
              />
            </div>
          </div>
        </div>
      </div>

      <Separator className="my-16" />

      {/* ── 2. Security ── */}
      <div className="grid grid-cols-1 gap-x-10 gap-y-8 lg:grid-cols-3">
        <div>
          <h2 className="flex items-center gap-2 font-montserrat font-extrabold uppercase tracking-wide text-sm text-foreground">
            <RiShieldLine className="h-4 w-4 shrink-0" />
            Security
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your password and account security
          </p>
        </div>
        <div className="lg:col-span-2">
          {!showPasswordForm ? (
            <Button onClick={() => setShowPasswordForm(true)}>
              Change Password
            </Button>
          ) : (
            <div className="space-y-4 max-w-md">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                  />
                  <Button
                    type="button"
                    variant="hollow"
                    size="icon"
                    className="absolute right-0 top-0"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? <RiEyeOffLine className="h-4 w-4" /> : <RiEyeLine className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={changePassword}
                  disabled={!newPassword || !confirmPassword || changingPassword}
                >
                  {changingPassword ? (
                    <>
                      <RiLoader2Line className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Update Password"
                  )}
                </Button>
                <Button
                  variant="hollow"
                  onClick={() => {
                    setShowPasswordForm(false);
                    setNewPassword("");
                    setConfirmPassword("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <Separator className="my-16" />

      {/* ── 3. Preferences ── */}
      <div className="grid grid-cols-1 gap-x-10 gap-y-8 lg:grid-cols-3">
        <div>
          <h2 className="flex items-center gap-2 font-montserrat font-extrabold uppercase tracking-wide text-sm text-foreground">
            <RiSettings3Line className="h-4 w-4 shrink-0" />
            Preferences
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Customize your experience and auto-processing behavior
          </p>
        </div>
        <div className="lg:col-span-2 space-y-6">
          {/* Timezone */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {timezones.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Auto-Processing sub-section */}
          <div className="space-y-4">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground/60">Auto-Processing</p>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="auto-naming">Auto-Naming</Label>
                <p className="text-sm text-muted-foreground">
                  Generate descriptive titles for imported calls
                </p>
              </div>
              <Switch
                id="auto-naming"
                checked={preferences.autoProcessingTitleGeneration}
                disabled={prefsLoading}
                onCheckedChange={async (checked) => {
                  try {
                    await updatePreference("autoProcessingTitleGeneration", checked);
                    toast.success(checked ? "Auto-naming enabled" : "Auto-naming disabled");
                  } catch {
                    toast.error("Failed to update preference");
                  }
                }}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="auto-tagging">Auto-Tagging</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically assign tags to imported calls
                </p>
              </div>
              <Switch
                id="auto-tagging"
                checked={preferences.autoProcessingTagging}
                disabled={prefsLoading}
                onCheckedChange={async (checked) => {
                  try {
                    await updatePreference("autoProcessingTagging", checked);
                    toast.success(checked ? "Auto-tagging enabled" : "Auto-tagging disabled");
                  } catch {
                    toast.error("Failed to update preference");
                  }
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <Separator className="my-16" />

      {/* ── 4. Integrations ── */}
      <div className="grid grid-cols-1 gap-x-10 gap-y-8 lg:grid-cols-3">
        <div>
          <h2 className="flex items-center gap-2 font-montserrat font-extrabold uppercase tracking-wide text-sm text-foreground">
            <RiPlugLine className="h-4 w-4 shrink-0" />
            Integrations
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Connect external services to enhance your workflow
          </p>
        </div>
        <div className="lg:col-span-2 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {/* Fathom Email */}
            <div className="space-y-2">
              <Label htmlFor="fathom-email">Fathom Email</Label>
              <Input
                id="fathom-email"
                type="email"
                placeholder="your-fathom-email@example.com"
                value={hostEmail}
                onChange={(e) => setHostEmail(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      <Separator className="my-16" />

      {/* ── 5. Danger Zone ── */}
      <div className="grid grid-cols-1 gap-x-10 gap-y-8 lg:grid-cols-3">
        <div>
          <h2 className="flex items-center gap-2 font-montserrat font-extrabold uppercase tracking-wide text-sm text-foreground">
            <RiAlertLine className="h-4 w-4 shrink-0" />
            Danger Zone
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Irreversible and destructive actions
          </p>
        </div>
        <div className="lg:col-span-2">
          <div className="border border-destructive/30 rounded-lg p-6">
            <div className="flex items-center justify-between gap-6">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Delete Account</p>
                <p className="text-sm text-muted-foreground">
                  Permanently delete your account and all associated data. This action cannot be undone.
                </p>
              </div>
              <Button variant="destructive" disabled={true} className="shrink-0">
                Delete Account
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Sticky Save Bar ── */}
      {isDirty && (
        <div className="sticky bottom-0 left-0 right-0 z-10 mt-12 -mx-6 border-t border-border bg-card px-6 py-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              You have unsaved changes
            </p>
            <div className="flex items-center gap-3">
              <Button
                variant="hollow"
                onClick={() => {
                  setDisplayName(savedValues.current.displayName);
                  setTimezone(savedValues.current.timezone);
                  setHostEmail(savedValues.current.hostEmail);
                }}
              >
                Discard
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <RiLoader2Line className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save changes"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Unsaved Changes Dialog (in-app navigation) ── */}
      <AlertDialog open={blocker.state === "blocked"}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes that will be lost if you leave this page. Are you sure you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => blocker.reset?.()}>
              Stay on page
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => blocker.proceed?.()}>
              Leave without saving
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
