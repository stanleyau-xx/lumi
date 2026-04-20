"use client";

import React, { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import { Button } from "@/components/ui/button";
import { Copy, Check, Brain, ChevronDown, ChevronRight, ChevronLeft, FileText, FileSpreadsheet, File, ImageIcon, Pencil } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { StockWidget } from "@/components/chat/stock-widget";
import { WeatherWidget, WeatherWidgetData } from "@/components/chat/weather-widget";

/** Clipboard helper with fallback for mobile browsers that lack navigator.clipboard */
async function copyToClipboardSafe(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
  } else {
    const el = document.createElement("textarea");
    el.value = text;
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.focus();
    el.select();
    document.execCommand("copy");
    document.body.removeChild(el);
  }
}

/** Extract [STATUS:thinking|searching] marker */
function parseStatusMarker(content: string): { isSearching: boolean; text: string } {
  const match = content.match(/\[STATUS:(thinking|searching)\]\n?/);
  if (match) {
    return { isSearching: match[1] === "searching", text: content.replace(match[0], "") };
  }
  // Legacy: no marker present, default to thinking
  return { isSearching: false, text: content };
}

/** Extract [STOCK:TICKER] marker from the start of a message */
function parseStockMarker(content: string): { stockTicker: string | null; text: string } {
  const trimmed = content.trimStart();
  const match = trimmed.match(/^\[STOCK:([A-Z0-9^.=-]+)\]/);
  if (match) {
    const text = trimmed.slice(match[0].length).replace(/^[\r\n]+/, "");
    return { stockTicker: match[1], text };
  }
  return { stockTicker: null, text: content };
}

/** Extract [WEATHER]{...}[/WEATHER] block from the content */
function parseWeatherBlock(content: string): { weatherData: WeatherWidgetData | null; text: string } {
  const match = content.match(/\[WEATHER\]([\s\S]*?)\[\/WEATHER\]/);
  if (match) {
    try {
      const weatherData: WeatherWidgetData = JSON.parse(match[1]);
      const text = content.replace(match[0], "").trim();
      return { weatherData, text };
    } catch {
      return { weatherData: null, text: content };
    }
  }
  return { weatherData: null, text: content };
}

function parseThinking(content: string): { thinking: string | null; response: string; isThinking: boolean } {
  const completeMatch = content.match(/^<think>([\s\S]*?)<\/think>\s*([\s\S]*)/);
  if (completeMatch) {
    return { thinking: completeMatch[1].trim(), response: completeMatch[2], isThinking: false };
  }
  const openMatch = content.match(/^<think>([\s\S]*)/);
  if (openMatch) {
    return { thinking: openMatch[1].trim(), response: "", isThinking: true };
  }
  return { thinking: null, response: content, isThinking: false };
}

function ThinkingBlock({ thinking, isThinking, isSearching }: { thinking: string | null; isThinking: boolean; isSearching: boolean }) {
  const [open, setOpen] = useState(isThinking);

  useEffect(() => {
    if (!isThinking) setOpen(false);
  }, [isThinking]);

  const label = isThinking
    ? isSearching ? "Researching…" : "Thinking…"
    : "Thought process";

  return (
    <div className="mb-3 rounded-xl border border-border/60 bg-muted/30 text-sm">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-muted-foreground hover:text-foreground transition-colors rounded-xl"
      >
        <Brain className="h-3.5 w-3.5 shrink-0" />
        <span className="flex-1 text-left font-medium text-xs">
          {label}
        </span>
        {isThinking ? (
          <span className="flex gap-0.5">
            <span className="inline-block h-1 w-1 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
            <span className="inline-block h-1 w-1 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
            <span className="inline-block h-1 w-1 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
          </span>
        ) : open ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
        )}
      </button>
      {open && (
        <div className="border-t border-border/50 px-3 py-2 text-xs text-muted-foreground italic whitespace-pre-wrap leading-relaxed">
          {thinking || (
            <span className="flex gap-1.5 items-center">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:0ms]" />
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:150ms]" />
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:300ms]" />
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/** Extract plain text from React children (handles strings and nested elements) */
function extractText(node: React.ReactNode): string {
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (React.isValidElement(node)) return extractText((node.props as any).children);
  return "";
}

/** Code block wrapper rendered from the <pre> override */
function CodeBlock({ language, rawText }: { language: string; rawText: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await copyToClipboardSafe(rawText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ margin: "1rem 0", borderRadius: "0.75rem", overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.4rem 1rem", background: "#0f0d0b", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <span style={{ fontSize: "0.75rem", color: "#6b6355", fontFamily: "sans-serif" }}>{language || "plaintext"}</span>
        <button
          onClick={copy}
          style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.75rem", color: copied ? "#a8c4a2" : "#6b6355", background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? "Copied!" : "Copy code"}
        </button>
      </div>
      {/* Code body */}
      <pre style={{ margin: 0, padding: "1.25rem", backgroundColor: "#1a1714", overflowX: "auto" }}>
        <code style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", fontSize: "0.875rem", lineHeight: "1.7", color: "#d4c9b8", backgroundColor: "#1a1714", display: "block", whiteSpace: "pre" }}>
          {rawText}
        </code>
      </pre>
    </div>
  );
}

type AttachmentPreview = {
  name: string;
  kind: "image" | "file" | "pdf";
  mimeType?: string;
  data?: string; // data-URL for images only
};

type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  parentId?: string | null;
  createdAt: string;
  attachmentPreviews?: AttachmentPreview[];
};

/** Parse [Image: name] / [File: name] / [PDF: name] labels embedded in stored message content */
function parseContentAttachments(content: string): { text: string; parsed: AttachmentPreview[] } {
  const parsed: AttachmentPreview[] = [];
  const regex = /\[(Image|File|PDF|Spreadsheet|CSV): ([^\]]+)\]/g;
  let m;
  while ((m = regex.exec(content)) !== null) {
    const tag = m[1];
    const kind: AttachmentPreview["kind"] = tag === "Image" ? "image" : tag === "PDF" ? "pdf" : "file";
    parsed.push({ kind, name: m[2] });
  }
  const text = content.replace(/\[(Image|File|PDF|Spreadsheet|CSV): [^\]]+\]/g, "").trim();
  return { text, parsed };
}

function FileIcon({ mimeType, name }: { mimeType?: string; name: string }) {
  if (mimeType === "application/pdf" || name.endsWith(".pdf"))
    return <FileText className="h-5 w-5 text-red-400 shrink-0" />;
  if (mimeType?.includes("spreadsheet") || mimeType?.includes("excel") || mimeType === "text/csv" || /\.(xlsx?|csv)$/i.test(name))
    return <FileSpreadsheet className="h-5 w-5 text-emerald-500 shrink-0" />;
  return <File className="h-5 w-5 text-muted-foreground shrink-0" />;
}

function AttachmentPreviews({ previews }: { previews: AttachmentPreview[] }) {
  if (!previews.length) return null;
  const images = previews.filter((a) => a.kind === "image");
  const nonImages = previews.filter((a) => a.kind !== "image");
  return (
    <div className="mb-2 flex flex-col gap-2">
      {/* Image grid */}
      {images.length > 0 && (
        <div className={cn("grid gap-1.5", images.length === 1 ? "grid-cols-1" : "grid-cols-2")}>
          {images.map((img, i) =>
            img.data ? (
              <img
                key={i}
                src={img.data}
                alt={img.name}
                className="rounded-xl object-cover max-h-64 w-full"
              />
            ) : (
              <div key={i} className="flex items-center gap-2.5 rounded-xl border border-border bg-muted/40 px-3 py-2.5">
                <ImageIcon className="h-5 w-5 text-muted-foreground shrink-0" />
                <span className="text-sm truncate text-foreground/90">{img.name}</span>
              </div>
            )
          )}
        </div>
      )}
      {/* PDF and file cards */}
      {nonImages.map((f, i) => (
        <div key={i} className="flex items-center gap-2.5 rounded-xl border border-border bg-muted/40 px-3 py-2.5">
          {f.kind === "pdf"
            ? <FileText className="h-5 w-5 text-red-400 shrink-0" />
            : <FileIcon mimeType={f.mimeType} name={f.name} />
          }
          <span className="text-sm truncate text-foreground/90">{f.name}</span>
        </div>
      ))}
    </div>
  );
}

interface MessageBubbleProps {
  message: Message;
  isStreaming?: boolean;
  branchCount?: number;
  branchIndex?: number;
  onBranchPrev?: () => void;
  onBranchNext?: () => void;
  onEdit?: (newContent: string) => void;
}

/** Show time-only for today's messages; month+day for older ones.
 *  The title attribute provides full date+time on hover. */
function formatTimestamp(createdAt: string): { display: string; title: string } {
  const date = new Date(createdAt);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  const display = sameDay
    ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString([], { month: "short", day: "numeric" });
  const title = date.toLocaleString([], {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
  return { display, title };
}

export function MessageBubble({
  message, isStreaming, branchCount = 1, branchIndex = 1,
  onBranchPrev, onBranchNext, onEdit,
}: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const isUser = message.role === "user";
  const ts = formatTimestamp(message.createdAt);

  const copyToClipboard = async () => {
    const text = isUser
      ? parseContentAttachments(message.content).text || message.content
      : message.content;
    await copyToClipboardSafe(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const startEditing = () => {
    const { text } = parseContentAttachments(message.content);
    setEditContent(text);
    setIsEditing(true);
  };

  if (!isUser) {
    // ── Assistant message ──────────────────────────────────────────────────
    const { stockTicker, text: contentWithoutWidget } = parseStockMarker(message.content);
    const { weatherData, text: contentWithoutWeather } = parseWeatherBlock(contentWithoutWidget);
    const { isSearching, text: contentWithoutStatus } = parseStatusMarker(contentWithoutWeather);
    const { thinking, response, isThinking } = parseThinking(contentWithoutStatus);
    const showThinking = isThinking || (isStreaming && !response);
    
    return (
      <div className="flex justify-start">
        <div className="group relative px-1 py-0">
          <Button
            variant="ghost"
            size="icon"
            className="absolute -left-10 top-0 h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground"
            onClick={copyToClipboard}
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          </Button>
          <div className="markdown-content">
            {stockTicker && <StockWidget symbol={stockTicker} />}
            {weatherData && <WeatherWidget data={weatherData} />}
            {showThinking && <ThinkingBlock thinking={thinking} isThinking={showThinking} isSearching={isSearching} />}
            {response && (
              <ReactMarkdown
                remarkPlugins={[remarkMath, remarkGfm]}
                rehypePlugins={[rehypeKatex]}
                components={{
                  pre({ children }: any) {
                    const codeChild = React.Children.toArray(children)[0] as any;
                    const className: string = codeChild?.props?.className || "";
                    const language = /language-(\w+)/.exec(className)?.[1] ?? "";
                    const rawText = extractText(codeChild?.props?.children ?? "");
                    return <CodeBlock language={language} rawText={rawText} />;
                  },
                  code({ className, children, ...props }: any) {
                    if (/language-/.test(className || "")) {
                      return <code className={className} {...props}>{children}</code>;
                    }
                    return (
                      <code className="rounded-md bg-muted px-1.5 py-0.5 text-[0.85em] font-mono" {...props}>
                        {children}
                      </code>
                    );
                  },
                  h1: ({ children }) => <h1 className="mt-6 mb-3 text-2xl font-bold">{children}</h1>,
                  h2: ({ children }) => <h2 className="mt-5 mb-2 text-xl font-semibold">{children}</h2>,
                  h3: ({ children }) => <h3 className="mt-4 mb-2 text-lg font-semibold">{children}</h3>,
                  h4: ({ children }) => <h4 className="mt-3 mb-1 text-base font-semibold">{children}</h4>,
                  p: ({ children }) => <p className="mb-4 last:mb-0 leading-7">{children}</p>,
                  ul: ({ children }) => <ul className="mb-4 space-y-1 list-disc pl-6">{children}</ul>,
                  ol: ({ children }) => <ol className="mb-4 space-y-1 list-decimal pl-6">{children}</ol>,
                  li: ({ children }) => <li className="leading-7">{children}</li>,
                  blockquote: ({ children }) => (
                    <blockquote className="my-4 border-l-4 border-primary/50 pl-4 text-muted-foreground italic">
                      {children}
                    </blockquote>
                  ),
                  hr: () => <hr className="my-6 border-border" />,
                  a: ({ href, children }) => (
                    <a href={href} target="_blank" rel="noopener noreferrer"
                      className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors">
                      {children}
                    </a>
                  ),
                  table: ({ children }) => (
                    <div className="my-4 w-full overflow-x-auto rounded-xl border border-border">
                      <table className="w-full border-collapse text-sm">{children}</table>
                    </div>
                  ),
                  thead: ({ children }) => <thead className="bg-muted/60">{children}</thead>,
                  tbody: ({ children }) => <tbody className="divide-y divide-border">{children}</tbody>,
                  tr: ({ children }) => <tr className="transition-colors hover:bg-muted/30">{children}</tr>,
                  th: ({ children }) => (
                    <th className="px-4 py-2.5 text-left font-semibold text-foreground border-b border-border">
                      {children}
                    </th>
                  ),
                  td: ({ children }) => <td className="px-4 py-2.5 text-foreground/90">{children}</td>,
                }}
              >
                {response}
              </ReactMarkdown>
            )}
          </div>
          {!isStreaming && !isThinking && (
            <p className="mt-1 text-xs text-muted-foreground" title={ts.title}>{ts.display}</p>
          )}
        </div>
      </div>
    );
  }

  // ── User message ───────────────────────────────────────────────────────────
  const previews: AttachmentPreview[] = message.attachmentPreviews?.length
    ? message.attachmentPreviews
    : parseContentAttachments(message.content).parsed;
  const { text } = parseContentAttachments(message.content);

  return (
    <div className="flex justify-end">
      <div className={cn("flex flex-col items-end gap-1", isEditing ? "w-full" : "max-w-[80%]")}>
        {/* Bubble */}
        <div className="user-bubble rounded-2xl px-4 py-3 text-foreground w-full">
          {isEditing ? (
            <div className="flex flex-col gap-2">
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (editContent.trim()) { onEdit?.(editContent.trim()); setIsEditing(false); }
                  }
                  if (e.key === "Escape") { setIsEditing(false); }
                }}
                className="min-h-[80px] resize-none text-sm bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 p-0 w-full"
                autoFocus
              />
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="ghost" className="h-7 text-xs"
                  onClick={() => { setIsEditing(false); }}>
                  Cancel
                </Button>
                <Button size="sm" className="h-7 text-xs"
                  onClick={() => { if (editContent.trim()) { onEdit?.(editContent.trim()); setIsEditing(false); } }}>
                  Send
                </Button>
              </div>
            </div>
          ) : (
            <>
              <AttachmentPreviews previews={previews} />
              {text && <p className="whitespace-pre-wrap">{text}</p>}
            </>
          )}
        </div>
        {/* Controls row below bubble: copy · edit (desktop only) · version nav · timestamp */}
        {!isStreaming && !isEditing && (
          <div className="flex items-center gap-0.5 text-muted-foreground">
            <button onClick={copyToClipboard}
              className="rounded p-1 hover:text-foreground transition-colors" title="Copy">
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
            {onEdit && (
              <button onClick={startEditing}
                className="inline-flex rounded p-1 hover:text-foreground transition-colors" title="Edit">
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
            {branchCount > 1 && (
              <>
                <button onClick={onBranchPrev} disabled={branchIndex <= 1}
                  className="rounded p-0.5 hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label="Previous version">
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <span className="tabular-nums text-xs">{branchIndex} / {branchCount}</span>
                <button onClick={onBranchNext} disabled={branchIndex >= branchCount}
                  className="rounded p-0.5 hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label="Next version">
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </>
            )}
            <span className="ml-1 text-xs" title={ts.title}>{ts.display}</span>
          </div>
        )}
      </div>
    </div>
  );
}
