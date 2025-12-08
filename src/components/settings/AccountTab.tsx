import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
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

export default function AccountTab() {
  const [displayName, setDisplayName] = useState("");
  const [savedDisplayName, setSavedDisplayName] = useState("");
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [userEmail, setUserEmail] = useState("");

  const [timezone, setTimezone] = useState("America/New_York");
  const [savedTimezone, setSavedTimezone] = useState("America/New_York");
  const [editingTimezone, setEditingTimezone] = useState(false);
  const [timezoneSaving, setTimezoneSaving] = useState(false);

  const [hostEmail, setHostEmail] = useState("");
  const [savedHostEmail, setSavedHostEmail] = useState("");
  const [editingHostEmail, setEditingHostEmail] = useState(false);
  const [hostEmailSaving, setHostEmailSaving] = useState(false);

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [_currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [_showCurrentPassword, _setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  useEffect(() => {
    loadProfileData();
  }, []);

  const loadProfileData = async () => {
    try {
      const { user, error: authError } = await getSafeUser();
      if (authError || !user) return;

      if (user) {
        setUserEmail(user.email || "");

        const { data: profile } = await supabase
          .from("user_profiles")
          .select("display_name")
          .eq("user_id", user.id)
          .maybeSingle();

        if (profile?.display_name) {
          setSavedDisplayName(profile.display_name);
        }

        const { data: settings } = await supabase
          .from("user_settings")
          .select("host_email")
          .eq("user_id", user.id)
          .maybeSingle();

        if (settings?.host_email) {
          setSavedHostEmail(settings.host_email);
        }
      }
    } catch (error) {
      logger.error("Error loading profile data", error);
    }
  };

  const saveProfile = async () => {
    try {
      setProfileSaving(true);
      const { user, error: authError } = await getSafeUser();
      if (authError || !user) return;

      const { error } = await supabase
        .from("user_profiles")
        .update({ display_name: displayName })
        .eq("user_id", user.id);

      if (error) throw error;

      setSavedDisplayName(displayName);
      setEditingProfile(false);
      toast.success("Profile updated successfully");
    } catch (error) {
      logger.error("Error saving profile", error);
      toast.error("Failed to update profile");
    } finally {
      setProfileSaving(false);
    }
  };

  const saveTimezone = async () => {
    try {
      setTimezoneSaving(true);
      const { user, error: authError } = await getSafeUser();
      if (authError || !user) return;

      // Save to user_settings table (future implementation)
      setSavedTimezone(timezone);
      setEditingTimezone(false);
      toast.success("Timezone updated successfully");
    } catch (error) {
      logger.error("Error saving timezone", error);
      toast.error("Failed to update timezone");
    } finally {
      setTimezoneSaving(false);
    }
  };

  const saveHostEmail = async () => {
    try {
      setHostEmailSaving(true);
      const { user, error: authError } = await getSafeUser();
      if (authError || !user) return;

      const { error } = await supabase
        .from("user_settings")
        .update({ host_email: hostEmail })
        .eq("user_id", user.id);

      if (error) throw error;

      setSavedHostEmail(hostEmail);
      setEditingHostEmail(false);
      toast.success("Fathom email updated successfully");
    } catch (error) {
      logger.error("Error saving host email", error);
      toast.error("Failed to update Fathom email");
    } finally {
      setHostEmailSaving(false);
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
      setCurrentPassword("");
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
            {savedDisplayName && !editingProfile ? (
              <div className="space-y-2">
                <Label htmlFor="display-name">Display Name</Label>
                <div className="flex gap-2">
                  <Input
                    id="display-name"
                    value={savedDisplayName}
                    readOnly
                    className="flex-1"
                  />
                  <Button
                    variant="hollow"
                    size="icon"
                    onClick={() => {
                      setDisplayName(savedDisplayName);
                      setEditingProfile(true);
                    }}
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
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    onClick={saveProfile}
                    disabled={!displayName || profileSaving}
                    size="icon"
                  >
                    {profileSaving ? (
                      <RiLoader2Line className="h-4 w-4 animate-spin" />
                    ) : (
                      <RiCheckboxCircleLine className="h-4 w-4" />
                    )}
                  </Button>
                  {editingProfile && (
                    <Button
                      onClick={() => {
                        setEditingProfile(false);
                        setDisplayName("");
                      }}
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
            {savedTimezone && !editingTimezone ? (
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <div className="flex gap-2">
                  <Input
                    id="timezone"
                    value={timezones.find(tz => tz.value === savedTimezone)?.label || savedTimezone}
                    readOnly
                    className="flex-1"
                  />
                  <Button
                    variant="hollow"
                    size="icon"
                    onClick={() => {
                      setTimezone(savedTimezone);
                      setEditingTimezone(true);
                    }}
                  >
                    <RiEditLine className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="timezone-edit">Timezone</Label>
                <div className="flex gap-2">
                  <Select value={timezone} onValueChange={setTimezone}>
                    <SelectTrigger className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {timezones.map((tz) => (
                        <SelectItem key={tz.value} value={tz.value}>
                          {tz.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={saveTimezone}
                    disabled={timezoneSaving}
                    size="icon"
                  >
                    {timezoneSaving ? (
                      <RiLoader2Line className="h-4 w-4 animate-spin" />
                    ) : (
                      <RiCheckboxCircleLine className="h-4 w-4" />
                    )}
                  </Button>
                  {editingTimezone && (
                    <Button
                      onClick={() => setEditingTimezone(false)}
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
            {savedHostEmail && !editingHostEmail ? (
              <div className="space-y-2">
                <Label htmlFor="fathom-email">Fathom Email</Label>
                <div className="flex gap-2">
                  <Input
                    id="fathom-email"
                    value={savedHostEmail}
                    readOnly
                    className="flex-1"
                  />
                  <Button
                    variant="hollow"
                    size="icon"
                    onClick={() => {
                      setHostEmail(savedHostEmail);
                      setEditingHostEmail(true);
                    }}
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
                    value={hostEmail}
                    onChange={(e) => setHostEmail(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    onClick={saveHostEmail}
                    disabled={!hostEmail || hostEmailSaving}
                    size="icon"
                  >
                    {hostEmailSaving ? (
                      <RiLoader2Line className="h-4 w-4 animate-spin" />
                    ) : (
                      <RiCheckboxCircleLine className="h-4 w-4" />
                    )}
                  </Button>
                  {editingHostEmail && (
                    <Button
                      onClick={() => setEditingHostEmail(false)}
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
                    setCurrentPassword("");
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
