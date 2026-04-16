"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SendHorizontal, Paperclip, X, FileSpreadsheet, FileText, Square } from "lucide-react";
import { ModelSelector } from "./model-selector";

type Provider = { id: string; name: string; type: string; enabled: boolean };
type Model = { id: string; providerId: string; modelId: string; displayName: string | null; description: string | null; enabled: boolean };

export type Attachment = {
  name: string;
  mimeType: string;
  data: string;  // data-URL
  kind: "image" | "spreadsheet" | "pdf";
};

interface ChatInputProps {
  onSend: (content: string, attachments: Attachment[]) => void;
  onStop?: () => void;
  isStreaming?: boolean;
  disabled?: boolean;
  providers?: Provider[];
  models?: Model[];
  selectedModelId?: string | null;
  onModelChange?: (modelId: string) => void;
}

const ACCEPTED_MIME_TYPES = new Set([
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "application/pdf",
]);

export function ChatInput({ onSend, onStop, isStreaming = false, disabled, providers = [], models = [], selectedModelId, onModelChange }: ChatInputProps) {
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [pendingReads, setPendingReads] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  useEffect(() => {
    // Don't auto-focus on touch devices — it pops the keyboard immediately
    if (!disabled && !window.matchMedia("(hover: none)").matches) {
      textareaRef.current?.focus();
    }
  }, [disabled]);

  // Resize + compress an image file to max 2048px, JPEG 85%
  const compressImage = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          const MAX_DIM = 2048;
          let { width, height } = img;
          if (width > MAX_DIM || height > MAX_DIM) {
            if (width >= height) {
              height = Math.round((height * MAX_DIM) / width);
              width = MAX_DIM;
            } else {
              width = Math.round((width * MAX_DIM) / height);
              height = MAX_DIM;
            }
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", 0.85));
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    });

  const processFiles = (files: File[]) => {
    const MAX_BYTES = 50 * 1024 * 1024; // 50 MB
    const unsupported = files.filter((f) => !ACCEPTED_MIME_TYPES.has(f.type));
    const supported = files.filter((f) => ACCEPTED_MIME_TYPES.has(f.type));
    if (unsupported.length > 0) {
      alert(
        `Unsupported file type: ${unsupported.map((f) => f.name).join(", ")}.\n` +
        `Supported types: images (JPEG, PNG, GIF, WebP), Excel, CSV, PDF.`
      );
    }
    if (supported.length === 0) return;
    const oversized = supported.filter((f) => f.size > MAX_BYTES);
    if (oversized.length > 0) {
      alert(`File too large: ${oversized.map((f) => f.name).join(", ")}. Maximum size is 50 MB.`);
      return;
    }
    setPendingReads((n) => n + supported.length);
    for (const file of supported) {
      if (file.type.startsWith("image/")) {
        compressImage(file)
          .then((dataUrl) => {
            setAttachments((prev) => [...prev, { name: file.name, mimeType: "image/jpeg", data: dataUrl, kind: "image" as const }]);
            setPendingReads((n) => n - 1);
          })
          .catch(() => setPendingReads((n) => n - 1));
      } else {
        // PDF and spreadsheets — read as-is and let the server parse them
        const kind: Attachment["kind"] = file.type === "application/pdf" ? "pdf" : "spreadsheet";
        const reader = new FileReader();
        reader.onload = () => {
          setAttachments((prev) => [...prev, { name: file.name, mimeType: file.type, data: reader.result as string, kind }]);
          setPendingReads((n) => n - 1);
        };
        reader.onerror = () => setPendingReads((n) => n - 1);
        reader.readAsDataURL(file);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(Array.from(e.target.files || []));
    e.target.value = "";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    processFiles(Array.from(e.dataTransfer.files));
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && attachments.length === 0) || disabled || isReadingFiles) return;
    onSend(input.trim(), attachments);
    setInput("");
    setAttachments([]);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = Array.from(e.clipboardData.items);
    const imageItems = items.filter((item) => item.type.startsWith("image/"));
    if (imageItems.length === 0) return;
    e.preventDefault();
    const files = imageItems.map((item) => item.getAsFile()).filter(Boolean) as File[];
    processFiles(files);
  };

  const showModelSelector = models.length > 0 && onModelChange;
  const isReadingFiles = pendingReads > 0;
  const hasContent = (input.trim() || attachments.length > 0) && !isReadingFiles && !isStreaming;

  return (
    <div className="shrink-0 px-4 pb-3 pt-2" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
      <div className="mx-auto max-w-3xl">
        <div
          className={`rounded-2xl border bg-card shadow-sm transition-colors ${isDragging ? "border-primary border-dashed bg-primary/5" : "border-border"}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {isDragging && (
            <div className="flex items-center justify-center py-6 text-sm font-medium text-primary pointer-events-none">
              Drop files here
            </div>
          )}

          {/* Attachment previews */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 px-4 pt-3">
              {attachments.map((att, i) => (
                <div
                  key={i}
                  className="group relative flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-2.5 py-1.5 text-xs"
                >
                  {att.kind === "image" ? (
                    <img
                      src={att.data}
                      alt={att.name}
                      className="h-8 w-8 rounded object-cover"
                    />
                  ) : att.kind === "pdf" ? (
                    <FileText className="h-4 w-4 shrink-0 text-red-400" />
                  ) : (
                    <FileSpreadsheet className="h-4 w-4 shrink-0 text-emerald-500" />
                  )}
                  <span className="max-w-[120px] truncate text-muted-foreground">{att.name}</span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(i)}
                    className="ml-0.5 rounded text-muted-foreground/60 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={handleSubmit} className="relative">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder="Message..."
              className="min-h-[80px] max-h-[200px] w-full resize-none border-0 bg-transparent px-4 pt-4 pb-14 text-base leading-relaxed focus-visible:ring-0 focus-visible:ring-offset-0"
              rows={1}
              disabled={disabled || isReadingFiles}
            />

            <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between gap-1 px-2 pb-2">
              {/* Left: attach button */}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  multiple
                  accept="image/jpeg,image/png,image/gif,image/webp,.xlsx,.xls,.csv,.pdf"
                  onChange={handleFileChange}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={disabled || isReadingFiles}
                  title={isReadingFiles ? "Reading file…" : "Attach image, PDF or spreadsheet"}
                >
                  <Paperclip className={`h-4 w-4 ${isReadingFiles ? "animate-pulse" : ""}`} />
                </Button>
              </div>

              {/* Right: model selector + send */}
              <div className="flex items-center gap-1">
                {showModelSelector && !isStreaming && (
                  <ModelSelector
                    providers={providers}
                    models={models}
                    selectedModelId={selectedModelId ?? null}
                    onModelChange={onModelChange}
                  />
                )}
                {isStreaming ? (
                  <Button
                    type="button"
                    size="icon"
                    onClick={onStop}
                    className="h-8 w-8 shrink-0 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
                    title="Stop generating"
                  >
                    <Square className="h-3.5 w-3.5 fill-current" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    size="icon"
                    disabled={!hasContent || disabled || isReadingFiles}
                    className="h-8 w-8 shrink-0 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-30"
                  >
                    <SendHorizontal className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </form>
        </div>

        <p className="mt-2 hidden text-center text-xs text-muted-foreground/70 md:block">
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
