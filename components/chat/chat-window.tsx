"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChatInput, type Attachment } from "./chat-input";
import { consumePendingAttachments } from "@/lib/pending-attachments";
import { MessageBubble } from "./message-bubble";
import { ChatEmpty } from "./chat-empty";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Trash2, Loader2 } from "lucide-react";

type AttachmentPreview = {
  name: string;
  kind: "image" | "file" | "pdf";
  mimeType?: string;
  data?: string; // data-URL, only available for the current session (images only)
};

type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  parentId: string | null;
  createdAt: string;
  attachmentPreviews?: AttachmentPreview[];
};

type Conversation = {
  id: string;
  title: string;
  modelId: string | null;
  providerId: string | null;
  systemPrompt: string | null;
  searchEnabled: boolean;
};

type Provider = {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
};

type Model = {
  id: string;
  providerId: string;
  modelId: string;
  displayName: string | null;
  description: string | null;
  enabled: boolean;
};

/** Build a map of effectiveParentId → children.
 *  Legacy messages (parentId=null) are virtually chained by createdAt order so old
 *  conversations work without a DB migration.  However:
 *  - A null-parentId message that appears AFTER the first tree message (any message
 *    with a real parentId) is treated as a true root sibling — not a continuation of
 *    the legacy chain.  This handles edits to the very first message.
 *  - Two consecutive null-parentId messages with the SAME role are treated as siblings
 *    (edit branches) rather than a chain.  This prevents a re-sent user message from
 *    appearing below the original when the stream was stopped before any AI reply. */
function buildBranchMap(messages: Message[]): {
  map: Map<string | null, Message[]>;
  effectiveParentIds: Map<string, string | null>;
} {
  const sorted = [...messages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  // Timestamp of the earliest message that has a real parentId.
  // Legacy chaining only applies to null-parentId messages that arrived before this point.
  const firstTreeTime = sorted.reduce((min, m) => {
    if (m.parentId === null) return min;
    const t = new Date(m.createdAt).getTime();
    return t < min ? t : min;
  }, Infinity);

  const map = new Map<string | null, Message[]>();
  const effectiveParentIds = new Map<string, string | null>();
  let prevLegacyId: string | null = null;
  let prevLegacyRole: string | null = null;

  for (const msg of sorted) {
    let effectivePid: string | null;
    if (msg.parentId !== null) {
      effectivePid = msg.parentId;
    } else if (new Date(msg.createdAt).getTime() < firstTreeTime) {
      // Pre-dates tree structure → apply legacy virtual chaining.
      // But two consecutive same-role messages are siblings (edits), not replies.
      effectivePid = (prevLegacyId !== null && prevLegacyRole !== msg.role)
        ? prevLegacyId
        : null;
    } else {
      // Appears after tree messages began → true root branch (sibling of other roots)
      effectivePid = null;
    }
    effectiveParentIds.set(msg.id, effectivePid);
    if (!map.has(effectivePid)) map.set(effectivePid, []);
    map.get(effectivePid)!.push(msg);
    if (msg.parentId === null) {
      prevLegacyId = msg.id;
      prevLegacyRole = msg.role;
    }
  }
  return { map, effectiveParentIds };
}

/** Walk the tree following active branches (defaults to latest child at each fork). */
function getActivePath(
  map: Map<string | null, Message[]>,
  activeBranches: Record<string, string>
): Message[] {
  const path: Message[] = [];
  let currentParentId: string | null = null;
  const visited = new Set<string>();
  while (true) {
    const children = map.get(currentParentId) ?? [];
    if (children.length === 0) break;
    const key: string = currentParentId ?? "root";
    const activeId: string | undefined = activeBranches[key];
    const activeChild: Message =
      (activeId ? children.find((c) => c.id === activeId) : null) ??
      children[children.length - 1];
    if (visited.has(activeChild.id)) break;
    visited.add(activeChild.id);
    path.push(activeChild);
    currentParentId = activeChild.id;
  }
  return path;
}

interface ChatWindowProps {
  conversationId: string;
}

export function ChatWindow({ conversationId }: ChatWindowProps) {
  const router = useRouter();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  // If there's a pending message, pre-populate it so the user bubble shows immediately
  const initialPending = typeof window !== "undefined" ? sessionStorage.getItem(`pending-message-${conversationId}`) : null;
  // initialPending can be "" (file-only send) — use null-check, not truthiness
  const hasPending = initialPending !== null;
  const [isStreaming, setIsStreaming] = useState(hasPending);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const [messages, setMessages] = useState<Message[]>(
    hasPending && initialPending
      ? [{ id: "pending-user", role: "user", content: initialPending, createdAt: new Date().toISOString(), parentId: null }]
      : []
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Branch navigation: maps effectiveParentId → activeChildId at each fork.
  // Persisted server-side (conversations.active_branches) so state is shared across devices.
  const [activeBranches, setActiveBranches] = useState<Record<string, string>>({});
  const saveBranchesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced save — fires 800 ms after the last branch change to avoid hammering the API.
  const saveActiveBranches = useCallback((branches: Record<string, string>) => {
    if (saveBranchesTimerRef.current) clearTimeout(saveBranchesTimerRef.current);
    saveBranchesTimerRef.current = setTimeout(() => {
      fetch(`/api/conversations/${conversationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ activeBranches: branches }),
      }).catch((err) => console.error("Failed to save branch state:", err));
    }, 800);
  }, [conversationId]);

  const setActiveBranchesAndSave = useCallback((
    updater: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)
  ) => {
    setActiveBranches((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      saveActiveBranches(next);
      return next;
    });
  }, [saveActiveBranches]);

  const { map: branchMap, effectiveParentIds } = buildBranchMap(messages);
  const activePath = getActivePath(branchMap, activeBranches);

  // Derive provider from selected model
  const selectedProviderId = models.find((m) => m.id === selectedModelId)?.providerId ?? null;

  useEffect(() => {
    const init = async () => {
      try {
        const [convRes, msgsRes, providersRes, modelsRes, userSettingsRes] = await Promise.all([
          fetch(`/api/conversations/${conversationId}`, { credentials: "include" }),
          fetch(`/api/conversations/${conversationId}/messages`, { credentials: "include" }),
          fetch("/api/admin/providers", { credentials: "include" }),
          fetch("/api/admin/models", { credentials: "include" }),
          fetch("/api/user/settings", { credentials: "include" }),
        ]);

        let convModelId: string | null = null;

        if (convRes.ok) {
          const conv = await convRes.json();
          setConversation(conv);
          convModelId = conv.modelId;
          // Restore branch state saved from any device
          if (conv.activeBranches) {
            try {
              setActiveBranches(JSON.parse(conv.activeBranches));
            } catch { /* malformed — ignore */ }
          }
        }

        if (msgsRes.ok) {
          const fetched = await msgsRes.json();
          // Don't wipe the pre-populated user bubble if DB hasn't saved the message yet
          if (fetched.length > 0) setMessages(fetched);
        }

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

        if (convModelId) {
          setSelectedModelId(convModelId);
        } else if (userSettingsRes.ok) {
          const settings = await userSettingsRes.json();
          const defaultId = settings.defaultModelId || settings.globalDefaultModelId;
          if (defaultId && loadedModels.some((m) => m.id === defaultId)) {
            setSelectedModelId(defaultId);
          } else if (loadedModels.length > 0) {
            setSelectedModelId(loadedModels[0].id);
          }
        }
      } catch (err) {
        console.error("Init failed:", err);
      } finally {
        setLoading(false);
        // Auto-send pending message created from new chat page
        const pending = sessionStorage.getItem(`pending-message-${conversationId}`);
        if (pending !== null) {
          sessionStorage.removeItem(`pending-message-${conversationId}`);
            const pendingAtts = consumePendingAttachments(conversationId);
          if (pendingAtts.length > 0) {
            setPendingAttachments(pendingAtts);
          }
          setPendingMessage(pending);
        }
      }
    };

    init();
  }, [conversationId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  });

  const handleSendMessage = async (
    content: string,
    attachments: Attachment[] = [],
    options?: { parentMessageId?: string | null }
  ) => {
    if (!content.trim() && attachments.length === 0) return;

    // Determine which message this new message follows.
    // If the last active message is a user message (stream was stopped before any AI reply),
    // treat a fresh send as a sibling edit rather than chaining after the unanswered user msg.
    const lastActiveMsg = activePath.length > 0 ? activePath[activePath.length - 1] : null;
    const isAutoEdit = options === undefined && lastActiveMsg?.role === "user";
    const parentMessageId =
      options?.parentMessageId !== undefined
        ? options.parentMessageId
        : isAutoEdit
          ? (effectiveParentIds.get(lastActiveMsg!.id) ?? null)
          : (lastActiveMsg ? lastActiveMsg.id : null);

    // Build display content: text + attachment labels
    const attachmentLabels = attachments
      .map((a) => {
        if (a.kind === "pdf") return `[PDF: ${a.name}]`;
        if (a.kind === "image") return `[Image: ${a.name}]`;
        return `[File: ${a.name}]`;
      })
      .join(" ");
    const displayContent = [content, attachmentLabels].filter(Boolean).join("\n");

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: displayContent,
      parentId: parentMessageId,
      createdAt: new Date().toISOString(),
      attachmentPreviews: attachments.map((a) => ({
        name: a.name,
        kind: a.kind === "image" ? "image" as const : a.kind === "pdf" ? "pdf" as const : "file" as const,
        mimeType: a.mimeType,
        data: a.kind === "image" ? a.data : undefined, // only pass data URL for images (thumbnails)
      })),
    };

    // Replace the pre-populated pending bubble if present, otherwise append
    setMessages((prev) =>
      prev.some((m) => m.id === "pending-user")
        ? prev.map((m) => (m.id === "pending-user" ? userMessage : m))
        : [...prev, userMessage]
    );
    setIsStreaming(true);
    // Switch active branch optimistically when editing (explicit or auto-detected).
    if (options?.parentMessageId !== undefined || isAutoEdit) {
      setActiveBranchesAndSave((prev) => ({ ...prev, [parentMessageId ?? "root"]: userMessage.id }));
    }
    setError(null);

    // Create a fresh AbortController for this request
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Declared outside try so catch block can read it when saving a stopped partial
    let assistantContent = "";

    try {
      // Build multipart form data — avoids base64 JSON overhead for large files
      const formData = new FormData();
      formData.append("content", content || "");
      if (selectedProviderId) formData.append("providerId", selectedProviderId);
      if (selectedModelId) formData.append("modelId", selectedModelId);
      formData.append("searchEnabled", "true");
      if (parentMessageId) formData.append("parentMessageId", parentMessageId);
      for (const att of attachments) {
        // Decode data URL manually so the MIME type is always preserved correctly.
        // Using fetch(dataURL).blob() can silently lose the MIME type in some browsers.
        const commaIdx = att.data.indexOf(",");
        const mime = att.data.slice(0, commaIdx).match(/:(.*?);/)?.[1] ?? att.mimeType;
        const binary = atob(att.data.slice(commaIdx + 1));
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: mime });
        formData.append("files", blob, att.name);
      }

      const res = await fetch(`/api/conversations/${conversationId}/message`, {
        method: "POST",
        body: formData,
        credentials: "include",
        signal: controller.signal,
      });

      if (!res.ok) {
        let errorMsg = "Failed to send message";
        try {
          const errorData = await res.json();
          errorMsg = errorData.error || errorMsg;
        } catch { /* response body was not JSON */ }
        throw new Error(errorMsg);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "",
        parentId: userMessage.id,
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        assistantContent += chunk;

        // Strip [STOCK:TICKER] marker from display — it's a widget hint, not body text.
        // (The full content including the marker is saved to DB server-side.)
        const displayContent = assistantContent.replace(/^\s*\[STOCK:[A-Z0-9^.=-]+\]\n?/, "");

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessage.id ? { ...msg, content: displayContent } : msg
          )
        );
      }

      // Refresh messages/conversation and notify sidebar of updated title
      const [freshMsgs, freshConv] = await Promise.all([
        fetch(`/api/conversations/${conversationId}/messages`).then((r) => r.ok ? r.json() : null),
        fetch(`/api/conversations/${conversationId}`).then((r) => r.ok ? r.json() : null),
      ]);
      if (freshMsgs) {
        setMessages((prev) => {
          const previewMap = new Map(
            prev.filter((m) => m.attachmentPreviews?.length).map((m) => [m.content, m.attachmentPreviews!])
          );
          return freshMsgs.map((m: Message) => ({
            ...m,
            attachmentPreviews: previewMap.get(m.content),
          }));
        });
        // If editing (explicit or auto-detected), update activeBranches to the real DB id.
        // parentMessageId may be null when the edited message was the very first one.
        if (options?.parentMessageId !== undefined || isAutoEdit) {
          const siblings: Message[] = freshMsgs.filter(
            (m: Message) => m.parentId === parentMessageId && m.role === "user"
          );
          if (siblings.length > 0) {
            const latest = siblings.reduce((a: Message, b: Message) =>
              new Date(a.createdAt) > new Date(b.createdAt) ? a : b
            );
            setActiveBranchesAndSave((prev) => ({ ...prev, [parentMessageId ?? "root"]: latest.id }));
          }
        }
      }
      if (freshConv) setConversation(freshConv);
      window.dispatchEvent(new CustomEvent("conversations-updated"));

      // Title is generated in the background — re-check after a delay to pick it up
      setTimeout(async () => {
        const updated = await fetch(`/api/conversations/${conversationId}`).then((r) => r.json());
        setConversation(updated);
        window.dispatchEvent(new CustomEvent("conversations-updated"));
      }, 5000);
    } catch (err: any) {
      if (err?.name === "AbortError") {
        // User stopped generation — await the save so it's in DB before isStreaming → false
        // (prevents the next message's DB refresh from racing ahead and dropping the partial)
        if (assistantContent) {
          await fetch(`/api/conversations/${conversationId}/messages`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ role: "assistant", content: assistantContent, parentId: userMessage.id }),
          }).catch((e) => console.error("Failed to save partial message:", e));
        }
      } else {
        console.error("Failed to send message:", err);
        setError(err.message || "Failed to send message");
        setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));
      }
    } finally {
      abortControllerRef.current = null;
      setIsStreaming(false);
    }
  };

  const handleStop = () => {
    abortControllerRef.current?.abort();
  };

  // Auto-send pending message after init (created from new chat page)
  useEffect(() => {
    if (pendingMessage !== null && !loading) {
      const msg = pendingMessage;
      const atts = pendingAttachments;
      setPendingMessage(null);
      setPendingAttachments([]);
      // Exclude the fake "pending-user" optimistic bubble when resolving the parent —
      // it doesn't exist in the DB so using its id as parentId would create a broken tree.
      const realParent = activePath.filter((m) => m.id !== "pending-user").slice(-1)[0]?.id ?? null;
      handleSendMessage(msg, atts, { parentMessageId: realParent });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingMessage, loading]);

  const handleModelChange = async (modelId: string) => {
    setSelectedModelId(modelId);
    const model = models.find((m) => m.id === modelId);
    const providerId = model?.providerId ?? null;
    fetch("/api/user/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ defaultModelId: modelId, defaultProviderId: providerId }),
    });
    fetch(`/api/conversations/${conversationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modelId, providerId }),
    });
  };

  const handleEditMessage = (message: Message, newContent: string) => {
    const effectivePid = effectiveParentIds.get(message.id) ?? null;
    handleSendMessage(newContent, [], { parentMessageId: effectivePid });
  };

  const handleBranchNav = (message: Message, direction: "prev" | "next") => {
    const effectivePid = effectiveParentIds.get(message.id) ?? null;
    const key = effectivePid ?? "root";
    // Navigate only among same-role siblings (user edits vs AI responses are separate)
    const siblings = (branchMap.get(effectivePid) ?? []).filter(
      (s) => s.role === message.role
    );
    const currentIdx = siblings.findIndex((s) => s.id === message.id);
    if (direction === "prev" && currentIdx > 0) {
      setActiveBranchesAndSave((prev) => ({ ...prev, [key]: siblings[currentIdx - 1].id }));
    } else if (direction === "next" && currentIdx < siblings.length - 1) {
      setActiveBranchesAndSave((prev) => ({ ...prev, [key]: siblings[currentIdx + 1].id }));
    }
  };

  const deleteConversation = async () => {
    await fetch(`/api/conversations/${conversationId}`, { method: "DELETE" });
    window.dispatchEvent(new CustomEvent("conversations-updated"));
    router.push("/chat");
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 shrink-0 items-center justify-end px-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowDeleteDialog(true)}
          className="h-11 w-11 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-5 w-5" />
        </Button>
      </div>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete conversation?</DialogTitle>
            <DialogDescription>
              This will permanently delete this conversation and all its messages. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-row gap-3 mt-2">
            <Button className="flex-1" variant="outline" onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
            <Button className="flex-1" variant="destructive" onClick={() => { setShowDeleteDialog(false); deleteConversation(); }}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex-1 overflow-y-auto" ref={scrollRef}>
        <div className="container mx-auto max-w-3xl px-4 py-6">
          {error && (
            <div className="mb-4 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {activePath.length === 0 && !isStreaming ? (
            <ChatEmpty onSendMessage={handleSendMessage} />
          ) : (
            <div className="space-y-6">
              {activePath.map((message, i) => {
                const effectivePid = effectiveParentIds.get(message.id) ?? null;
                // Only count same-role siblings — avoids mixing user edits with AI responses
                const siblings = (branchMap.get(effectivePid) ?? []).filter(
                  (s) => s.role === message.role
                );
                const branchIndex = siblings.findIndex((s) => s.id === message.id) + 1;
                const branchCount = siblings.length;
                return (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    isStreaming={isStreaming && i === activePath.length - 1 && message.role === "assistant"}
                    branchCount={branchCount}
                    branchIndex={branchIndex}
                    onBranchPrev={branchCount > 1 ? () => handleBranchNav(message, "prev") : undefined}
                    onBranchNext={branchCount > 1 ? () => handleBranchNav(message, "next") : undefined}
                    onEdit={message.role === "user" && !isStreaming ? (c) => handleEditMessage(message, c) : undefined}
                  />
                );
              })}

              {isStreaming && (activePath.length === 0 || activePath[activePath.length - 1]?.role === "user") && (
                <MessageBubble
                  message={{
                    id: "streaming",
                    role: "assistant",
                    content: "",
                    parentId: null,
                    createdAt: new Date().toISOString(),
                  }}
                  isStreaming
                />
              )}
            </div>
          )}
        </div>
      </div>

      <ChatInput
        onSend={(content, attachments) => handleSendMessage(content, attachments)}
        onStop={handleStop}
        isStreaming={isStreaming}
        disabled={false}
        providers={providers}
        models={models}
        selectedModelId={selectedModelId}
        onModelChange={handleModelChange}
      />

    </div>
  );
}
