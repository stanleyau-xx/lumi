import type { Attachment } from "@/components/chat/chat-input";

// In-memory store for attachments that need to survive a Next.js soft navigation.
// sessionStorage is too small for base64 file data.
let _conversationId: string | null = null;
let _attachments: Attachment[] = [];

export function storePendingAttachments(conversationId: string, attachments: Attachment[]) {
  _conversationId = conversationId;
  _attachments = attachments;
}

export function consumePendingAttachments(conversationId: string): Attachment[] {
  if (_conversationId === conversationId) {
    const atts = _attachments;
    _conversationId = null;
    _attachments = [];
    return atts;
  }
  return [];
}
