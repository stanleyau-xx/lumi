"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Pencil, Trash2, CheckCircle, XCircle, Link as LinkIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Provider = {
  id: string;
  name: string;
  type: string;
  baseUrl: string | null;
  authMethod: string;
  enabled: boolean;
  oauthExpiresAt: string | null;
  createdAt: string;
};

const PROVIDER_TYPES = [
  { value: "openai", label: "OpenAI" },
  { value: "claude", label: "Claude (Anthropic)" },
  { value: "openrouter", label: "OpenRouter" },
  { value: "minimax", label: "MiniMax" },
  { value: "minimax-cn", label: "MiniMax-CN" },
];

export default function ProvidersPage() {
  const { toast } = useToast();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingConnection, setTestingConnection] = useState<string | null>(null);
  const [connectingOAuth, setConnectingOAuth] = useState<string | null>(null);

  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    type: "openai",
    baseUrl: "",
    authMethod: "api_key",
    apiKey: "",
    oauthClientId: "",
    oauthClientSecret: "",
    oauthTokenUrl: "",
    enabled: true,
  });

  useEffect(() => {
    fetchProviders();
  }, []);

  const fetchProviders = async () => {
    try {
      const res = await fetch("/api/admin/providers");
      if (res.ok) {
        const data = await res.json();
        setProviders(data);
      }
    } catch (error) {
      console.error("Failed to fetch providers:", error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      type: "openai",
      baseUrl: "",
      authMethod: "api_key",
      apiKey: "",
      oauthClientId: "",
      oauthClientSecret: "",
      oauthTokenUrl: "",
      enabled: true,
    });
  };

  const handleAddProvider = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        toast({ title: "Provider added successfully" });
        setIsAddDialogOpen(false);
        resetForm();
        fetchProviders();
      } else {
        const error = await res.json();
        toast({ title: error.error || "Failed to add provider", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to add provider", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleEditProvider = async () => {
    if (!editingProvider) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/providers/${editingProvider.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        toast({ title: "Provider updated successfully" });
        setIsEditDialogOpen(false);
        setEditingProvider(null);
        resetForm();
        fetchProviders();
      } else {
        const error = await res.json();
        toast({ title: error.error || "Failed to update provider", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to update provider", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProvider = async (id: string) => {
    if (!confirm("Are you sure you want to delete this provider?")) return;

    try {
      const res = await fetch(`/api/admin/providers/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast({ title: "Provider deleted successfully" });
        fetchProviders();
      } else {
        toast({ title: "Failed to delete provider", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to delete provider", variant: "destructive" });
    }
  };

  const handleTestConnection = async (id: string) => {
    setTestingConnection(id);
    try {
      const res = await fetch(`/api/admin/providers/${id}/test`, { method: "POST" });
      const data = await res.json();

      if (data.success) {
        toast({ title: "Connection successful!", description: `Found ${data.models?.length || 0} models` });
      } else {
        toast({ title: "Connection failed", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Connection test failed", variant: "destructive" });
    } finally {
      setTestingConnection(null);
    }
  };

  const handleOAuthConnect = async (id: string) => {
    setConnectingOAuth(id);
    try {
      const res = await fetch(`/api/admin/providers/${id}/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grantType: "client_credentials" }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        toast({ title: "OAuth connected successfully", description: data.expiresAt ? `Expires: ${new Date(data.expiresAt).toLocaleString()}` : undefined });
        fetchProviders();
      } else {
        toast({ title: "OAuth failed", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "OAuth connection failed", variant: "destructive" });
    } finally {
      setConnectingOAuth(null);
    }
  };

  const openEditDialog = (provider: Provider) => {
    setEditingProvider(provider);
    setFormData({
      name: provider.name,
      type: provider.type,
      baseUrl: provider.baseUrl || "",
      authMethod: provider.authMethod,
      apiKey: "",
      oauthClientId: "",
      oauthClientSecret: "",
      oauthTokenUrl: "",
      enabled: provider.enabled,
    });
    setIsEditDialogOpen(true);
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
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">AI Providers</h1>
          <p className="text-muted-foreground">Manage your AI provider connections</p>
        </div>

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Provider
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add AI Provider</DialogTitle>
              <DialogDescription>Configure a new AI provider connection</DialogDescription>
            </DialogHeader>
            <ProviderForm
              formData={formData}
              setFormData={setFormData}
              onSubmit={handleAddProvider}
              saving={saving}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {providers.map((provider) => (
          <Card key={provider.id}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{provider.name}</h3>
                      <Badge variant={provider.enabled ? "default" : "secondary"}>
                        {provider.enabled ? "Enabled" : "Disabled"}
                      </Badge>
                      <Badge variant="outline">{provider.type}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {PROVIDER_TYPES.find((t) => t.value === provider.type)?.label || provider.type}
                    </p>
                    {provider.baseUrl && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Base URL: {provider.baseUrl}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {provider.authMethod === "oauth2" && (
                    <>
                      {provider.oauthExpiresAt ? (
                        <Badge variant="default">
                          <CheckCircle className="mr-1 h-3 w-3" />
                          Connected
                        </Badge>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOAuthConnect(provider.id)}
                          disabled={connectingOAuth === provider.id}
                        >
                          {connectingOAuth === provider.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <LinkIcon className="mr-1 h-4 w-4" />
                          )}
                          Connect OAuth
                        </Button>
                      )}
                    </>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTestConnection(provider.id)}
                    disabled={testingConnection === provider.id}
                  >
                    {testingConnection === provider.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Test"
                    )}
                  </Button>

                  <Button variant="ghost" size="icon" onClick={() => openEditDialog(provider)}>
                    <Pencil className="h-4 w-4" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteProvider(provider.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {providers.length === 0 && (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              No providers configured. Add your first provider to get started.
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Provider</DialogTitle>
            <DialogDescription>Update provider settings</DialogDescription>
          </DialogHeader>
          <ProviderForm
            formData={formData}
            setFormData={setFormData}
            onSubmit={handleEditProvider}
            saving={saving}
            isEdit
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProviderForm({
  formData,
  setFormData,
  onSubmit,
  saving,
  isEdit,
}: {
  formData: any;
  setFormData: (data: any) => void;
  onSubmit: () => void;
  saving: boolean;
  isEdit?: boolean;
}) {
  return (
    <div className="space-y-4 py-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="My OpenAI"
          />
        </div>
        <div>
          <Label htmlFor="type">Type</Label>
          <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROVIDER_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="baseUrl">Base URL (optional)</Label>
        <Input
          id="baseUrl"
          value={formData.baseUrl}
          onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
          placeholder="Override default endpoint"
        />
      </div>

      <div>
        <Label htmlFor="authMethod">Auth Method</Label>
        <Select value={formData.authMethod} onValueChange={(v) => setFormData({ ...formData, authMethod: v })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="api_key">API Key</SelectItem>
            <SelectItem value="oauth2">OAuth 2.0</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {formData.authMethod === "api_key" && (
        <div>
          <Label htmlFor="apiKey">{isEdit ? "New API Key (leave empty to keep current)" : "API Key"}</Label>
          <Input
            id="apiKey"
            type="password"
            value={formData.apiKey}
            onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
            placeholder="sk-..."
          />
        </div>
      )}

      {formData.authMethod === "oauth2" && (
        <>
          <div>
            <Label htmlFor="oauthClientId">OAuth Client ID</Label>
            <Input
              id="oauthClientId"
              value={formData.oauthClientId}
              onChange={(e) => setFormData({ ...formData, oauthClientId: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="oauthClientSecret">OAuth Client Secret</Label>
            <Input
              id="oauthClientSecret"
              type="password"
              value={formData.oauthClientSecret}
              onChange={(e) => setFormData({ ...formData, oauthClientSecret: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="oauthTokenUrl">Token URL</Label>
            <Input
              id="oauthTokenUrl"
              value={formData.oauthTokenUrl}
              onChange={(e) => setFormData({ ...formData, oauthTokenUrl: e.target.value })}
              placeholder="https://..."
            />
          </div>
        </>
      )}

      <div className="flex items-center gap-2">
        <Switch
          checked={formData.enabled}
          onCheckedChange={(v) => setFormData({ ...formData, enabled: v })}
        />
        <Label>Enabled</Label>
      </div>

      <DialogFooter>
        <Button onClick={onSubmit} disabled={saving}>
          {saving ? "Saving..." : isEdit ? "Update Provider" : "Add Provider"}
        </Button>
      </DialogFooter>
    </div>
  );
}
