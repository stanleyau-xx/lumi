"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { ChatWindow } from "@/components/chat/chat-window";

export default function ChatPage() {
  const params = useParams();
  const conversationId = params.id as string;

  if (!conversationId) {
    return <EmptyChat />;
  }

  return <ChatWindow conversationId={conversationId} />;
}

function EmptyChat() {
  const createConversation = async () => {
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const data = await res.json();
        window.location.href = `/chat/${data.id}`;
      }
    } catch (error) {
      console.error("Failed to create conversation:", error);
    }
  };

  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-semibold mb-4">Welcome to Lumi</h2>
        <p className="text-muted-foreground mb-6">
          Select a conversation or start a new one
        </p>
        <Button onClick={createConversation}>Start New Chat</Button>
      </div>
    </div>
  );
}

import { Button } from "@/components/ui/button";
