"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Search, Trash2, MoreVertical, MessageSquare, PanelLeftClose, Settings, LogOut } from "lucide-react";
import { formatDate } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type Conversation = {
  id: string;
  title: string;
  updatedAt: string;
  searchEnabled: boolean;
};

interface ChatSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onToggle: () => void;
}

export function ChatSidebar({ isOpen, onClose, onToggle }: ChatSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchConversations = useCallback(async (q?: string) => {
    try {
      const url = q ? `/api/conversations?q=${encodeURIComponent(q)}` : "/api/conversations";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
      }
    } catch (error) {
      console.error("Failed to fetch conversations:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
    const handler = () => fetchConversations(search || undefined);
    window.addEventListener("conversations-updated", handler);
    return () => window.removeEventListener("conversations-updated", handler);
  }, [fetchConversations]);

  useEffect(() => {
    const timer = setTimeout(() => fetchConversations(search || undefined), 200);
    return () => clearTimeout(timer);
  }, [search, fetchConversations]);

  const createConversation = () => {
    router.push("/chat");
    if (window.innerWidth < 768) onClose();
  };

  const deleteConversation = async (id: string) => {
    try {
      await fetch(`/api/conversations/${id}`, { method: "DELETE" });
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (pathname === `/chat/${id}`) {
        router.push("/chat");
      }
    } catch (error) {
      console.error("Failed to delete conversation:", error);
    }
  };

  const groupedConversations = conversations.reduce((acc, conv) => {
    const date = formatDate(new Date(conv.updatedAt));
    if (!acc[date]) acc[date] = [];
    acc[date].push(conv);
    return acc;
  }, {} as Record<string, Conversation[]>);

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 md:hidden",
          isOpen ? "block" : "hidden"
        )}
        onClick={onClose}
      />


      <aside
        className={cn(
          "sidebar-bg flex h-full w-64 flex-col border-r transition-all duration-300 shrink-0",
          "max-md:fixed max-md:left-0 max-md:top-0 max-md:z-50",
          isOpen ? "translate-x-0" : "-translate-x-full md:-ml-64"
        )}
      >
        <div className="flex h-14 items-center gap-1 px-3">
          <Button
            onClick={createConversation}
            variant="ghost"
            className="flex-1 justify-start gap-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Plus className="h-4 w-4" />
            New chat
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className="shrink-0 text-muted-foreground hover:text-foreground"
            title="Close sidebar"
          >
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        </div>

        <div className="relative p-3">
          <Search className="absolute left-6 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <ScrollArea className="flex-1">
          {loading ? (
            <div className="flex items-center justify-center p-4">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : Object.keys(groupedConversations).length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
              <MessageSquare className="mb-2 h-8 w-8" />
              <p className="text-sm">No conversations yet</p>
            </div>
          ) : (
            <div className="space-y-4 p-3">
              {Object.entries(groupedConversations).map(([date, convs]) => (
                <div key={date}>
                  <h3 className="mb-2 px-2 text-xs font-medium text-muted-foreground">
                    {date}
                  </h3>
                  <div className="space-y-1">
                    {convs.map((conv) => {
                      const isActive = pathname === `/chat/${conv.id}`;
                      return (
                        <div
                          key={conv.id}
                          className={cn(
                            "group flex items-center gap-2 rounded-lg px-2 py-1.5",
                            isActive ? "bg-accent text-foreground" : "hover:bg-accent/60"
                          )}
                        >
                          <Link
                            href={`/chat/${conv.id}`}
                            onClick={() => { if (window.innerWidth < 768) onClose(); }}
                            className="flex-1 overflow-hidden"
                          >
                            <span className="block truncate text-sm">{conv.title}</span>
                          </Link>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => deleteConversation(conv.id)}
                                className="text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="border-t p-3 flex items-center gap-1">
          <Button
            variant="ghost"
            className="flex-1 justify-start gap-2 text-sm text-muted-foreground hover:text-foreground"
            asChild
          >
            <Link href="/settings">
              <Settings className="h-4 w-4" />
              Settings
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 text-muted-foreground hover:text-destructive"
            onClick={async () => { await signOut({ redirect: false }); window.location.href = "/login"; }}
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </aside>
    </>
  );
}
