"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

type Provider = { id: string; name: string; type: string; enabled: boolean };
type Model = { id: string; providerId: string; modelId: string; displayName: string | null; enabled: boolean };

interface ModelContextType {
  providers: Provider[];
  models: Model[];
  selectedModelId: string | null;
  isStreaming: boolean;
  setSelectedModelId: (id: string) => void;
  setIsStreaming: (v: boolean) => void;
  handleModelChange: (modelId: string) => void;
}

const ModelContext = createContext<ModelContextType | null>(null);

export function ModelProvider({ children }: { children: ReactNode }) {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);

  useEffect(() => {
    const init = async () => {
      const [providersRes, modelsRes, userSettingsRes] = await Promise.all([
        fetch("/api/admin/providers", { credentials: "include" }),
        fetch("/api/admin/models", { credentials: "include" }),
        fetch("/api/user/settings", { credentials: "include" }),
      ]);

      let loadedModels: Model[] = [];
      if (modelsRes.ok) {
        const all = await modelsRes.json();
        loadedModels = all.filter((m: Model) => m.enabled);
        setModels(loadedModels);
      }
      if (providersRes.ok) {
        const all = await providersRes.json();
        setProviders(all.filter((p: Provider) => p.enabled));
      }
      if (userSettingsRes.ok) {
        const settings = await userSettingsRes.json();
        const defaultId = settings.defaultModelId || settings.globalDefaultModelId;
        if (defaultId && loadedModels.some((m) => m.id === defaultId)) {
          setSelectedModelId(defaultId);
        } else if (loadedModels.length > 0) {
          setSelectedModelId(loadedModels[0].id);
        }
      }
    };
    init();
  }, []);

  const handleModelChange = (modelId: string) => {
    setSelectedModelId(modelId);
    const model = models.find((m) => m.id === modelId);
    fetch("/api/user/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ defaultModelId: modelId, defaultProviderId: model?.providerId }),
      credentials: "include",
    });
  };

  return (
    <ModelContext.Provider value={{ providers, models, selectedModelId, isStreaming, setSelectedModelId, setIsStreaming, handleModelChange }}>
      {children}
    </ModelContext.Provider>
  );
}

export function useModel() {
  const ctx = useContext(ModelContext);
  if (!ctx) throw new Error("useModel must be used within ModelProvider");
  return ctx;
}
