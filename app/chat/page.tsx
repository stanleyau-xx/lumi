"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChatInput } from "@/components/chat/chat-input";
import { ChatEmpty } from "@/components/chat/chat-empty";
import { storePendingAttachments } from "@/lib/pending-attachments";

type Provider = { id: string; name: string; type: string; enabled: boolean };
type Model = { id: string; providerId: string; modelId: string; displayName: string | null; description: string | null; enabled: boolean };

export default function NewChatPage() {
  const router = useRouter();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

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

  const handleSend = async (content: string, attachments?: any[]) => {
    setIsSending(true);
    try {
      const model = models.find((m) => m.id === selectedModelId);
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelId: selectedModelId, providerId: model?.providerId }),
        credentials: "include",
      });
      if (!res.ok) return;
      const conv = await res.json();
      sessionStorage.setItem(`pending-message-${conv.id}`, content);
      if (attachments && attachments.length > 0) {
        storePendingAttachments(conv.id, attachments);
      }
      window.dispatchEvent(new CustomEvent("conversations-updated"));
      router.push(`/chat/${conv.id}`);
    } finally {
      setIsSending(false);
    }
  };

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
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="h-full w-full overflow-hidden">
          <ChatEmpty onSendMessage={handleSend} />
        </div>
      </div>

      <ChatInput
        onSend={handleSend}
        disabled={isSending}
        providers={providers}
        models={models}
        selectedModelId={selectedModelId}
        onModelChange={handleModelChange}
      />
    </div>
  );
}
