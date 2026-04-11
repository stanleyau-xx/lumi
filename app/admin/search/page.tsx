"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, TestTube } from "lucide-react";

type SearchSettings = {
  url: string;
  enabled: boolean;
  defaultLanguage: string;
  safeSearch: number;
  username: string;
  password: string;
};

export default function SearchPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<SearchSettings>({
    url: "",
    enabled: false,
    defaultLanguage: "en",
    safeSearch: 0,
    username: "",
    password: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/admin/search");
      if (res.ok) setSettings(await res.json());
    } catch (error) {
      console.error("Failed to fetch settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/search", {
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

  const handleTest = async () => {
    if (!settings.url) {
      toast({ title: "Please enter a SearXNG URL first", variant: "destructive" });
      return;
    }

    setTesting(true);
    try {
      const res = await fetch("/api/admin/search/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: settings.url,
          username: settings.username,
          password: settings.password,
        }),
      });

      if (res.ok) {
        toast({ title: "Connection successful!" });
      } else {
        const data = await res.json();
        toast({ title: "Connection failed", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Connection test failed", variant: "destructive" });
    } finally {
      setTesting(false);
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
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Web Search Configuration</h1>
        <p className="text-muted-foreground">Configure SearXNG for web search functionality</p>
      </div>

      <div className="max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>SearXNG Settings</CardTitle>
            <CardDescription>
              Configure your SearXNG instance for enhanced AI responses with web search
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="url">SearXNG URL</Label>
              <Input
                id="url"
                value={settings.url}
                onChange={(e) => setSettings({ ...settings, url: e.target.value })}
                placeholder="http://192.168.1.x:8080"
                className="mt-1"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                The URL of your SearXNG instance (include port if different from 80)
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={settings.enabled}
                onCheckedChange={(v) => setSettings({ ...settings, enabled: v })}
              />
              <Label>Enable Web Search</Label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="username">Username <span className="text-muted-foreground">(optional)</span></Label>
                <Input
                  id="username"
                  value={settings.username}
                  onChange={(e) => setSettings({ ...settings, username: e.target.value })}
                  placeholder="Leave blank if no auth"
                  className="mt-1"
                  autoComplete="off"
                />
              </div>
              <div>
                <Label htmlFor="password">Password <span className="text-muted-foreground">(optional)</span></Label>
                <Input
                  id="password"
                  type="password"
                  value={settings.password}
                  onChange={(e) => setSettings({ ...settings, password: e.target.value })}
                  placeholder="Leave blank if no auth"
                  className="mt-1"
                  autoComplete="off"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="language">Default Language</Label>
                <Input
                  id="language"
                  value={settings.defaultLanguage}
                  onChange={(e) => setSettings({ ...settings, defaultLanguage: e.target.value })}
                  placeholder="en"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="safeSearch">Safe Search (0-2)</Label>
                <Input
                  id="safeSearch"
                  type="number"
                  min="0"
                  max="2"
                  value={settings.safeSearch}
                  onChange={(e) => setSettings({ ...settings, safeSearch: parseInt(e.target.value) || 0 })}
                  className="mt-1"
                />
                <p className="mt-1 text-xs text-muted-foreground">0 = None, 1 = Moderate, 2 = Strict</p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save Settings"}
              </Button>
              <Button variant="outline" onClick={handleTest} disabled={testing}>
                {testing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <TestTube className="mr-2 h-4 w-4" />
                )}
                Test Connection
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
