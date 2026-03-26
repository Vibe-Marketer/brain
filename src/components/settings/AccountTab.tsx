import { useState, useEffect } from "react";
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
import { RiEditLine, RiCheckboxCircleLine, RiCloseCircleLine, RiLoader2Line, RiEyeLine, RiEyeOffLine } from "@remixicon/react";
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

/**
 * Encapsulates the repeated "editable field" pattern:
 * value, savedValue, isEditing, isSaving.
 */
function useEditableField(initialValue = "") {
  const [value, setValue] = useState(initialValue);
  const [savedValue, setSavedValue] = useState(initialValue);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const startEditing = () => {
    setValue(savedValue);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setValue("");
  };

  const markSaved = (val: string) => {
    setSavedValue(val);
    setIsEditing(false);
  };

  return {
    value, setValue,
    savedValue, setSavedValue,
    isEditing, setIsEditing,
    isSaving, setIsSaving,
    startEditing, cancelEditing, markSaved,
  };
}

export default function AccountTab() {
  const profile = useEditableField("");
  const tz = useEditableField("America/New_York");
  const host = useEditableField("");
  const [userEmail, setUserEmail] = useState("");

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const { preferences, isLoading: prefsLoading, loadPreferences, updatePreference } = usePreferencesStore();

  useEffect(() => {
    loadProfileData();
    loadPreferences();
  }, []);

  const loadProfileData = async () => {
    try {
      const { user, error: authError } = await getSafeUser();
      if (authError || !user) return;

      if (user) {
        setUserEmail(user.email || "");

        const { data: profileData } = await supabase
          .from("user_profiles")
          .select("display_name")
          .eq("user_id", user.id)
          .maybeSingle();

        if (profileData?.display_name) {
          profile.setSavedValue(profileData.display_name);
        }

        const { data: settings } = await supabase
          .from("user_settings")
          .select("host_email")
          .eq("user_id", user.id)
          .maybeSingle();

        if (settings?.host_email) {
          host.setSavedValue(settings.host_email);
        }
      }
    } catch (error) {
      logger.error("Error loading profile data", error);
    }
  };

  const saveProfile = async () => {
    try {
      profile.setIsSaving(true);
      const { user, error: authError } = await getSafeUser();
      if (authError || !user) return;

      const { error } = await supabase
        .from("user_profiles")
        .update({ display_name: profile.value })
        .eq("user_id", user.id);

      if (error) throw error;

      profile.markSaved(profile.value);
      toast.success("Profile updated successfully");
    } catch (error) {
      logger.error("Error saving profile", error);
      toast.error("Failed to update profile");
    } finally {
      profile.setIsSaving(false);
    }
  };

  const saveTimezone = async () => {
    try {
      tz.setIsSaving(true);
      const { user, error: authError } = await getSafeUser();
      if (authError || !user) return;

      // Save to user_settings table (future implementation)
      tz.markSaved(tz.value);
      toast.success("Timezone updated successfully");
    } catch (error) {
      logger.error("Error saving timezone", error);
      toast.error("Failed to update timezone");
    } finally {
      tz.setIsSaving(false);
    }
  };

  const saveHostEmail = async () => {
    try {
      host.setIsSaving(true);
      const { user, error: authError } = await getSafeUser();
      if (authError || !user) return;

      const { error } = await supabase
        .from("user_settings")
        .update({ host_email: host.value })
        .eq("user_id", user.id);

      if (error) throw error;

      host.markSaved(host.value);
      toast.success("Fathom email updated successfully");
    } catch (error) {
      logger.error("Error saving host email", error);
      toast.error("Failed to update Fathom email");
    } finally {
      host.setIsSaving(false);
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

  return (
    <div>
      {/* Top separator for breathing room */}
      <Separator className="mb-12" />

      {/* Profile Section */}
      <div className="grid grid-cols-1 gap-x-10 gap-y-8 lg:grid-cols-3">
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-gray-50">Profile</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">
            Your personal information and display settings
          </p>
        </div>
        <div className="lg:col-span-2 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {/* Display Name */}
            {profile.savedValue && !profile.isEditing ? (
              <div className="space-y-2">
                <Label htmlFor="display-name">Display Name</Label>
                <div className="flex gap-2">
                  <Input
                    id="display-name"
                    value={profile.savedValue}
                    readOnly
                    className="flex-1"
                  />
                  <Button
                    variant="hollow"
                    size="icon"
                    onClick={profile.startEditing}
                  >
                    <RiEditLine className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="display-name-edit">Display Name</Label>
                <div className="flex gap-2">
                  <Input
                    id="display-name-edit"
                    placeholder="Enter your display name"
                    value={profile.value}
                    onChange={(e) => profile.setValue(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    onClick={saveProfile}
                    disabled={!profile.value || profile.isSaving}
                    size="icon"
                  >
                    {profile.isSaving ? (
                      <RiLoader2Line className="h-4 w-4 animate-spin" />
                    ) : (
                      <RiCheckboxCircleLine className="h-4 w-4" />
                    )}
                  </Button>
                  {profile.isEditing && (
                    <Button
                      onClick={profile.cancelEditing}
                      variant="hollow"
                      size="icon"
                    >
                      <RiCloseCircleLine className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            )}

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

      {/* Preferences Section */}
      <div className="grid grid-cols-1 gap-x-10 gap-y-8 lg:grid-cols-3">
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-gray-50">Preferences</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">
            Customize your experience
          </p>
        </div>
        <div className="lg:col-span-2 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {/* Timezone */}
            {tz.savedValue && !tz.isEditing ? (
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <div className="flex gap-2">
                  <Input
                    id="timezone"
                    value={timezones.find(t => t.value === tz.savedValue)?.label || tz.savedValue}
                    readOnly
                    className="flex-1"
                  />
                  <Button
                    variant="hollow"
                    size="icon"
                    onClick={tz.startEditing}
                  >
                    <RiEditLine className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="timezone-edit">Timezone</Label>
                <div className="flex gap-2">
                  <Select value={tz.value} onValueChange={tz.setValue}>
                    <SelectTrigger className="flex-1">
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
                  <Button
                    onClick={saveTimezone}
                    disabled={tz.isSaving}
                    size="icon"
                  >
                    {tz.isSaving ? (
                      <RiLoader2Line className="h-4 w-4 animate-spin" />
                    ) : (
                      <RiCheckboxCircleLine className="h-4 w-4" />
                    )}
                  </Button>
                  {tz.isEditing && (
                    <Button
                      onClick={tz.cancelEditing}
                      variant="hollow"
                      size="icon"
                    >
                      <RiCloseCircleLine className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Fathom Email */}
            {host.savedValue && !host.isEditing ? (
              <div className="space-y-2">
                <Label htmlFor="fathom-email">Fathom Email</Label>
                <div className="flex gap-2">
                  <Input
                    id="fathom-email"
                    value={host.savedValue}
                    readOnly
                    className="flex-1"
                  />
                  <Button
                    variant="hollow"
                    size="icon"
                    onClick={host.startEditing}
                  >
                    <RiEditLine className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="fathom-email-edit">Fathom Email</Label>
                <div className="flex gap-2">
                  <Input
                    id="fathom-email-edit"
                    type="email"
                    placeholder="your-fathom-email@example.com"
                    value={host.value}
                    onChange={(e) => host.setValue(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    onClick={saveHostEmail}
                    disabled={!host.value || host.isSaving}
                    size="icon"
                  >
                    {host.isSaving ? (
                      <RiLoader2Line className="h-4 w-4 animate-spin" />
                    ) : (
                      <RiCheckboxCircleLine className="h-4 w-4" />
                    )}
                  </Button>
                  {host.isEditing && (
                    <Button
                      onClick={host.cancelEditing}
                      variant="hollow"
                      size="icon"
                    >
                      <RiCloseCircleLine className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <Separator className="my-16" />

      {/* Auto-Processing Section */}
      <div className="grid grid-cols-1 gap-x-10 gap-y-8 lg:grid-cols-3">
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-gray-50">Auto-Processing</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">
            Automatically enhance calls when they are imported
          </p>
        </div>
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="auto-naming">Auto-Naming</Label>
              <p className="text-sm text-gray-500 dark:text-gray-500">
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
              <p className="text-sm text-gray-500 dark:text-gray-500">
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

      <Separator className="my-16" />

      {/* Password Section */}
      <div className="grid grid-cols-1 gap-x-10 gap-y-8 lg:grid-cols-3">
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-gray-50">Password</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">
            Update your password
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
    </div>
  );
}
