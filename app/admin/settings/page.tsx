"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

type GlobalSettings = {
  defaultModel: string;
  defaultProvider: string;
  systemPromptTemplate: string;
  maxHistoryMessages: number;
  rateLimitPerDay: number;
};

export default function SettingsAdminPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<GlobalSettings>({
    defaultModel: "",
    defaultProvider: "",
    systemPromptTemplate: "",
    maxHistoryMessages: 20,
    rateLimitPerDay: 0,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/admin/settings");
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch (error) {
      console.error("Failed to fetch settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
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

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Global Settings</h1>
        <p className="text-muted-foreground">Configure system-wide settings</p>
      </div>

      <div className="max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>AI Settings</CardTitle>
            <CardDescription>Default settings for new conversations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="systemPromptTemplate">System Prompt Template</Label>
              <Textarea
                id="systemPromptTemplate"
                value={settings.systemPromptTemplate}
                onChange={(e) => setSettings({ ...settings, systemPromptTemplate: e.target.value })}
                placeholder="You are a helpful AI assistant."
                className="mt-1"
                rows={4}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                This template is used as the default system prompt for new conversations
              </p>
            </div>

            <div>
              <Label htmlFor="maxHistoryMessages">Max History Messages</Label>
              <Input
                id="maxHistoryMessages"
                type="number"
                min="1"
                max="100"
                value={settings.maxHistoryMessages}
                onChange={(e) => setSettings({ ...settings, maxHistoryMessages: parseInt(e.target.value) || 20 })}
                className="mt-1"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Number of recent messages to send to the AI (sliding window)
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rate Limiting</CardTitle>
            <CardDescription>Control usage limits per user</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="rateLimitPerDay">Messages per Day (per user)</Label>
              <Input
                id="rateLimitPerDay"
                type="number"
                min="0"
                value={settings.rateLimitPerDay}
                onChange={(e) => setSettings({ ...settings, rateLimitPerDay: parseInt(e.target.value) || 0 })}
                className="mt-1"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Set to 0 for unlimited
              </p>
            </div>
          </CardContent>
        </Card>

        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Settings"}
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>About</CardTitle>
            <CardDescription>Application information</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Version <span className="font-mono font-medium text-foreground">v1.0.0</span>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
    </div>
  );
}
