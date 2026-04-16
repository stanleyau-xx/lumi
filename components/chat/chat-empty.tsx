"use client";

import { Lightbulb } from "lucide-react";
import { useState, useEffect } from "react";


function getGreeting(fullName: string): string {
  const hour = new Date().getHours();
  const period =
    hour >= 5 && hour < 12 ? "Good Morning" :
    hour >= 12 && hour < 17 ? "Good Afternoon" :
    hour >= 17 && hour < 21 ? "Good Evening" :
    "Good Night";
  return `${period}, ${fullName}`;
}

interface ChatEmptyProps {
  onSendMessage: (content: string) => void;
}

export function ChatEmpty({ onSendMessage }: ChatEmptyProps) {
  const [prompts, setPrompts] = useState<string[] | null>(null);
  const [greeting, setGreeting] = useState("How can I help you today?");

  useEffect(() => {
    fetch("/api/user/profile")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.fullName) setGreeting(getGreeting(data.fullName)); })
      .catch(() => {});

    fetch("/api/prompts")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.prompts?.length) setPrompts(data.prompts); })
      .catch(() => {});
  }, []);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center py-16 px-4">
      <h2 className="mb-2 text-3xl font-semibold tracking-tight text-center">{greeting}</h2>
      <p className="mb-10 text-sm text-muted-foreground text-center">Ask anything — I&apos;m here to help.</p>

      <div className="grid w-full max-w-2xl grid-cols-2 gap-3">
        {prompts !== null && prompts.map((prompt, index) => (
              <button
                key={index}
                onClick={() => onSendMessage(prompt)}
                className="group flex items-start gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 text-left text-sm transition-colors hover:border-primary/40 hover:bg-accent"
              >
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span className="text-foreground/80 group-hover:text-foreground">{prompt}</span>
              </button>
            ))}
      </div>
    </div>
  );
}
