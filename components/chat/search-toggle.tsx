"use client";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Globe } from "lucide-react";

interface SearchToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

export function SearchToggle({ enabled, onToggle }: SearchToggleProps) {
  return (
    <div className="flex items-center gap-2">
      <Globe className="h-4 w-4 text-muted-foreground" />
      <Switch checked={enabled} onCheckedChange={onToggle} />
    </div>
  );
}
