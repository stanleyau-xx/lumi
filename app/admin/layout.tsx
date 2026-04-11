"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Server,
  Database,
  Search,
  Users,
  Settings,
  ChevronLeft,
} from "lucide-react";

const navItems = [
  { href: "/admin/providers", label: "Providers", icon: Server },
  { href: "/admin/models", label: "Models", icon: Database },
  { href: "/admin/search", label: "Search", icon: Search },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className="w-64 border-r bg-background">
        <div className="flex h-14 items-center border-b px-4">
          <Link href="/chat" className="flex items-center gap-2 text-lg font-semibold">
            <ChevronLeft className="h-5 w-5" />
            <span>Back to Chat</span>
          </Link>
        </div>

        <nav className="p-4">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              return (
                <li key={item.href}>
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    className={cn("w-full justify-start gap-2", isActive && "bg-accent")}
                    asChild
                  >
                    <Link href={item.href}>
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  </Button>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>

      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
