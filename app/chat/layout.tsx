"use client";

import { useState, useEffect } from "react";
import { ChatSidebar } from "@/components/chat/chat-sidebar";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    if (mq.matches) setSidebarOpen(false);
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) setSidebarOpen(false);
      else setSidebarOpen(true);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return (
    <div className="flex h-full overflow-hidden bg-background">
      <ChatSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onToggle={() => setSidebarOpen((v) => !v)}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        {!sidebarOpen && (
          <div className="absolute left-2 top-2 z-30">
            <Button variant="ghost" size="icon" className="h-11 w-11" onClick={() => setSidebarOpen(true)}>
              <Menu className="h-6 w-6" />
            </Button>
          </div>
        )}

        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
