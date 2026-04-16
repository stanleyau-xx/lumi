"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

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

interface ModelSelectorProps {
  providers: Provider[];
  models: Model[];
  selectedModelId: string | null;
  onModelChange?: (modelId: string) => void;
}

/** Infer a short subtitle from model name/id for well-known model families */
function inferSubtitle(name: string, modelId: string): string | null {
  const s = (name + " " + modelId).toLowerCase();
  if (s.includes("opus")) return "Most capable for complex tasks";
  if (s.includes("sonnet")) return "Great balance of speed & intelligence";
  if (s.includes("haiku")) return "Fastest for quick answers";
  if (s.includes("gpt-4o-mini") || s.includes("4o-mini")) return "Fast & affordable";
  if (s.includes("gpt-4o")) return "Smart & versatile";
  if (s.includes("gpt-4")) return "Highly capable";
  if (s.includes("gpt-3.5") || s.includes("gpt3.5")) return "Fast & cost-effective";
  if (s.includes("o3-mini") || s.includes("o1-mini")) return "Fast reasoning model";
  if (s.includes("o3") || s.includes("o1")) return "Advanced reasoning model";
  if (s.includes("gemini-2.0-flash") || s.includes("gemini-flash")) return "Fast & efficient";
  if (s.includes("gemini-2.0") || s.includes("gemini-1.5-pro")) return "Multimodal & capable";
  if (s.includes("gemini")) return "Google's AI model";
  if (s.includes("deepseek-r1")) return "Open-source reasoning model";
  if (s.includes("deepseek")) return "Open-source AI model";
  if (s.includes("llama")) return "Open-source language model";
  if (s.includes("mistral") || s.includes("mixtral")) return "Open-source & efficient";
  if (s.includes("grok")) return "xAI's language model";
  return null;
}

export function ModelSelector({ providers, models, selectedModelId, onModelChange }: ModelSelectorProps) {
  const [open, setOpen] = useState(false);

  const enabledModels = models.filter((m) => m.enabled);

  const selectedModel = enabledModels.find((m) => m.id === selectedModelId);
  const selectedName = selectedModel?.displayName || selectedModel?.modelId || "Select model";

  if (enabledModels.length === 0) return null;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-medium",
            "text-foreground/80 hover:text-foreground hover:bg-muted/60",
            "transition-colors outline-none select-none"
          )}
        >
          <span>{selectedName}</span>
          <ChevronDown className={cn("h-3.5 w-3.5 opacity-60 transition-transform", open && "rotate-180")} />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="center"
        sideOffset={8}
        className="w-72 rounded-2xl p-1.5 shadow-xl border border-border/50"
      >
        {enabledModels.map((model) => {
          const name = model.displayName || model.modelId;
          const subtitle = model.description || inferSubtitle(name, model.modelId);
          const isSelected = model.id === selectedModelId;

          return (
            <button
              key={model.id}
              onClick={() => {
                onModelChange?.(model.id);
                setOpen(false);
              }}
              className={cn(
                "w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left",
                "hover:bg-muted/70 transition-colors",
                isSelected && "bg-muted/40"
              )}
            >
              {/* Checkmark column */}
              <div className="w-4 shrink-0">
                {isSelected && <Check className="h-4 w-4 text-foreground" strokeWidth={2.5} />}
              </div>

              {/* Name + subtitle */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium leading-snug">{name}</div>
                {subtitle && (
                  <div className="text-xs text-muted-foreground leading-snug mt-0.5">{subtitle}</div>
                )}
              </div>
            </button>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
