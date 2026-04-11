"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, RefreshCw, Star, Pencil, Check, X, Plus, Trash2 } from "lucide-react";

type Model = {
  id: string;
  providerId: string;
  modelId: string;
  displayName: string | null;
  description: string | null;
  enabled: boolean;
  provider?: {
    name: string;
    type: string;
  };
};

export default function ModelsPage() {
  const { toast } = useToast();
  const [models, setModels] = useState<Model[]>([]);
  const [defaultModelId, setDefaultModelId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [fetchingModels, setFetchingModels] = useState<string | null>(null);
  const [settingDefault, setSettingDefault] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState("");
  const [editingDesc, setEditingDesc] = useState<string | null>(null);
  const [editDescValue, setEditDescValue] = useState("");
  const [addingModel, setAddingModel] = useState<string | null>(null);
  const [newModelId, setNewModelId] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetchModels();
    fetchDefaultModel();
  }, []);

  const fetchModels = async () => {
    try {
      const res = await fetch("/api/admin/models");
      if (res.ok) setModels(await res.json());
    } catch (error) {
      console.error("Failed to fetch models:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDefaultModel = async () => {
    try {
      const res = await fetch("/api/admin/settings");
      if (res.ok) {
        const data = await res.json();
        setDefaultModelId(data.defaultModelId || null);
      }
    } catch (error) {
      console.error("Failed to fetch default model:", error);
    }
  };

  const handleToggleEnabled = async (id: string, enabled: boolean) => {
    setUpdating(id);
    try {
      const res = await fetch(`/api/admin/models/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (res.ok) {
        setModels((prev) => prev.map((m) => (m.id === id ? { ...m, enabled } : m)));
      } else {
        toast({ title: "Failed to update model", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to update model", variant: "destructive" });
    } finally {
      setUpdating(null);
    }
  };

  const handleSetDefault = async (model: Model) => {
    setSettingDefault(model.id);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultModelId: model.id }),
      });
      if (res.ok) {
        setDefaultModelId(model.id);
        toast({ title: `${model.displayName || model.modelId} set as default` });
      } else {
        toast({ title: "Failed to set default model", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to set default model", variant: "destructive" });
    } finally {
      setSettingDefault(null);
    }
  };

  const handleSaveName = async (model: Model) => {
    const displayName = editNameValue.trim() || null;
    try {
      const res = await fetch(`/api/admin/models/${model.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName }),
      });
      if (res.ok) {
        setModels((prev) => prev.map((m) => m.id === model.id ? { ...m, displayName } : m));
        toast({ title: "Name updated" });
      } else {
        toast({ title: "Failed to update name", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to update name", variant: "destructive" });
    } finally {
      setEditingName(null);
    }
  };

  const handleSaveDesc = async (model: Model) => {
    const description = editDescValue.trim() || null;
    try {
      const res = await fetch(`/api/admin/models/${model.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });
      if (res.ok) {
        setModels((prev) => prev.map((m) => m.id === model.id ? { ...m, description } : m));
        toast({ title: "Description updated" });
      } else {
        toast({ title: "Failed to update description", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to update description", variant: "destructive" });
    } finally {
      setEditingDesc(null);
    }
  };

  const handleAddModel = async (providerId: string) => {
    const modelId = newModelId.trim();
    if (!modelId) return;
    try {
      const res = await fetch("/api/admin/models/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerId, manualModelIds: [modelId] }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: "Model added" });
        setNewModelId("");
        setAddingModel(null);
        fetchModels();
      } else {
        toast({ title: "Failed to add model", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to add model", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      const res = await fetch(`/api/admin/models/${id}`, { method: "DELETE" });
      if (res.ok) {
        setModels((prev) => prev.filter((m) => m.id !== id));
        if (defaultModelId === id) setDefaultModelId(null);
        toast({ title: "Model removed" });
      } else {
        toast({ title: "Failed to remove model", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to remove model", variant: "destructive" });
    } finally {
      setDeleting(null);
      setConfirmDelete(null);
    }
  };

  const handleFetchFromProvider = async (providerId: string) => {
    setFetchingModels(providerId);
    try {
      const res = await fetch("/api/admin/models/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerId }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: "Models fetched", description: `Added ${data.added?.length || 0} new models` });
        fetchModels();
      } else {
        toast({ title: "Failed to fetch models", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to fetch models", variant: "destructive" });
    } finally {
      setFetchingModels(null);
    }
  };

  const groupedModels = models.reduce((acc, model) => {
    const providerName = model.provider?.name || model.providerId;
    if (!acc[providerName]) acc[providerName] = [];
    acc[providerName].push(model);
    return acc;
  }, {} as Record<string, Model[]>);

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
        <h1 className="text-2xl font-bold">AI Models</h1>
        <p className="text-muted-foreground">
          Manage available models. The default model is used for new users and new conversations.
        </p>
      </div>

      <div className="space-y-6">
        {Object.entries(groupedModels).map(([providerName, providerModels]) => (
          <Card key={providerName}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{providerName}</CardTitle>
                  <CardDescription>{providerModels.length} models</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {addingModel === providerModels[0].providerId ? (
                    <>
                      <Input
                        value={newModelId}
                        onChange={(e) => setNewModelId(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleAddModel(providerModels[0].providerId);
                          if (e.key === "Escape") setAddingModel(null);
                        }}
                        placeholder="model-id"
                        className="h-8 w-48 text-sm"
                        autoFocus
                      />
                      <Button size="sm" onClick={() => handleAddModel(providerModels[0].providerId)}>Add</Button>
                      <Button size="sm" variant="ghost" onClick={() => setAddingModel(null)}>Cancel</Button>
                    </>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setAddingModel(providerModels[0].providerId); setNewModelId(""); }}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Model
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleFetchFromProvider(providerModels[0].providerId)}
                    disabled={fetchingModels === providerModels[0].providerId}
                  >
                    {fetchingModels === providerModels[0].providerId ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    Fetch from Provider
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {providerModels.map((model) => {
                  const isDefault = model.id === defaultModelId;
                  return (
                    <div
                      key={model.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="flex items-center gap-4">
                        <Switch
                          checked={model.enabled}
                          onCheckedChange={(enabled) => handleToggleEnabled(model.id, enabled)}
                          disabled={updating === model.id}
                        />
                        <div className="flex flex-col gap-1">
                          {/* Name row */}
                          <div className="flex items-center gap-2">
                            {editingName === model.id ? (
                              <>
                                <Input
                                  value={editNameValue}
                                  onChange={(e) => setEditNameValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") handleSaveName(model);
                                    if (e.key === "Escape") setEditingName(null);
                                  }}
                                  placeholder={model.modelId}
                                  className="h-7 w-40 text-sm"
                                  autoFocus
                                />
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleSaveName(model)}>
                                  <Check className="h-3.5 w-3.5 text-green-600" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingName(null)}>
                                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                                </Button>
                              </>
                            ) : (
                              <>
                                <span className="font-medium">
                                  {model.displayName || model.modelId}
                                </span>
                                {model.displayName && (
                                  <Badge variant="outline" className="text-xs">{model.modelId}</Badge>
                                )}
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6 opacity-50 hover:opacity-100"
                                  onClick={() => { setEditingName(model.id); setEditNameValue(model.displayName || ""); }}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                {isDefault && (
                                  <Badge className="gap-1 bg-primary/10 text-primary hover:bg-primary/20">
                                    <Star className="h-2.5 w-2.5 fill-current" />
                                    Default
                                  </Badge>
                                )}
                              </>
                            )}
                          </div>
                          {/* Description row */}
                          <div className="flex items-center gap-2">
                            {editingDesc === model.id ? (
                              <>
                                <Input
                                  value={editDescValue}
                                  onChange={(e) => setEditDescValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") handleSaveDesc(model);
                                    if (e.key === "Escape") setEditingDesc(null);
                                  }}
                                  placeholder="Short description shown in model picker…"
                                  className="h-7 w-64 text-sm"
                                  autoFocus
                                />
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleSaveDesc(model)}>
                                  <Check className="h-3.5 w-3.5 text-green-600" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingDesc(null)}>
                                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                                </Button>
                              </>
                            ) : (
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-muted-foreground">
                                  {model.description || <span className="italic">No description</span>}
                                </span>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-5 w-5 opacity-50 hover:opacity-100"
                                  onClick={() => { setEditingDesc(model.id); setEditDescValue(model.description || ""); }}
                                >
                                  <Pencil className="h-2.5 w-2.5" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant={isDefault ? "secondary" : "ghost"}
                          size="sm"
                          onClick={() => handleSetDefault(model)}
                          disabled={isDefault || settingDefault === model.id}
                          className="text-xs"
                        >
                          {settingDefault === model.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : isDefault ? (
                            "Default"
                          ) : (
                            "Set as Default"
                          )}
                        </Button>
                        {confirmDelete === model.id ? (
                          <>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="text-xs"
                              onClick={() => handleDelete(model.id)}
                              disabled={deleting === model.id}
                            >
                              {deleting === model.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Confirm"}
                            </Button>
                            <Button size="sm" variant="ghost" className="text-xs" onClick={() => setConfirmDelete(null)}>
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => setConfirmDelete(model.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}

        {models.length === 0 && (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              No models configured. Add a provider first, then fetch models.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
