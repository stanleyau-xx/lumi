"use client";

import { useState, useEffect } from "react";
import { version } from "../../package.json";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft } from "lucide-react";

type UserSettings = {
  defaultModelId: string | null;
  defaultProviderId: string | null;
  systemPromptPrefix: string | null;
};

type Provider = {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
};

type Model = {
  id: string;
  modelId: string;
  displayName: string | null;
  providerId: string;
  enabled: boolean;
};

export default function SettingsPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);

  const [fullName, setFullName] = useState("");

  const [settings, setSettings] = useState<UserSettings>({
    defaultModelId: null,
    defaultProviderId: null,
    systemPromptPrefix: null,
  });

  const [providers, setProviders] = useState<Provider[]>([]);
  const [models, setModels] = useState<Model[]>([]);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [settingsRes, providersRes, modelsRes, profileRes] = await Promise.all([
        fetch("/api/user/settings"),
        fetch("/api/admin/providers"),
        fetch("/api/admin/models"),
        fetch("/api/user/profile"),
      ]);

      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        setSettings(settingsData);
      }

      if (providersRes.ok) {
        const providersData = await providersRes.json();
        setProviders(providersData.filter((p: Provider) => p.enabled));
      }

      if (modelsRes.ok) {
        const modelsData = await modelsRes.json();
        setModels(modelsData.filter((m: Model) => m.enabled));
      }

      if (profileRes.ok) {
        const profileData = await profileRes.json();
        setFullName(profileData.fullName ?? "");
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!fullName.trim()) {
      toast({ title: "Full name cannot be empty", variant: "destructive" });
      return;
    }
    setProfileSaving(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName }),
      });
      if (res.ok) {
        toast({ title: "Profile updated successfully" });
      } else {
        const data = await res.json();
        toast({ title: data.error || "Failed to update profile", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to update profile", variant: "destructive" });
    } finally {
      setProfileSaving(false);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/user/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      if (res.ok) {
        toast({ title: "Settings saved successfully" });
      } else {
        toast({ title: "Failed to save settings", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to save settings", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }

    if (newPassword.length < 8) {
      toast({ title: "Password must be at least 8 characters", variant: "destructive" });
      return;
    }

    setPasswordLoading(true);
    try {
      const res = await fetch("/api/user/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (res.ok) {
        toast({ title: "Password changed successfully" });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        const data = await res.json();
        toast({ title: data.error || "Failed to change password", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to change password", variant: "destructive" });
    } finally {
      setPasswordLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
    <div className="container mx-auto max-w-2xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">Settings</h1>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>Your account information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Username</Label>
              <Input value={session?.user?.name || ""} disabled className="mt-1" />
            </div>
            <div>
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your full name"
                className="mt-1"
              />
            </div>
            <Button onClick={handleSaveProfile} disabled={profileSaving}>
              {profileSaving ? "Saving..." : "Save Profile"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Change Password</CardTitle>
            <CardDescription>Update your password</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="currentPassword">Current Password</Label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1"
              />
            </div>
            <Button onClick={handleChangePassword} disabled={passwordLoading}>
              {passwordLoading ? "Changing..." : "Change Password"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Preferences</CardTitle>
            <CardDescription>Set your default preferences</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="systemPromptPrefix">System Prompt Prefix</Label>
              <Textarea
                id="systemPromptPrefix"
                value={settings.systemPromptPrefix || ""}
                onChange={(e) =>
                  setSettings({ ...settings, systemPromptPrefix: e.target.value })
                }
                placeholder="Optional prefix for your system prompts"
                className="mt-1 min-h-[120px] resize-y"
              />
            </div>

            <Separator />

            <Button onClick={handleSaveSettings} disabled={saving}>
              {saving ? "Saving..." : "Save Preferences"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <footer className="mt-8 text-center text-xs text-muted-foreground">
        v{version}
      </footer>
    </div>
    </div>
  );
}
