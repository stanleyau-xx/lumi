import { auth } from "@/auth";
import { db, schema } from "@/db";
import { eq, asc } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { NextResponse } from "next/server";
import { streamChat, ChatMessage } from "@/lib/providers";
import { search, formatSearchResults, getSearXNGConfig } from "@/lib/searxng";
import { extractSearchQuery } from "@/lib/search-extractor";
import { ocrPdfBuffer } from "@/lib/ocr";

function isRecoverableError(error: any): boolean {
  const status = error?.status;
  const msg = (error?.message || "").toLowerCase();
  return (
    status === 429 || status === 502 || status === 503 || status === 504 ||
    msg.includes("timeout") || msg.includes("rate limit") ||
    msg.includes("unavailable") || msg.includes("too large") ||
    msg.includes("overloaded")
  );
}

async function pipeAIStream(
  aiStream: ReadableStream,
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder
): Promise<string> {
  const reader = aiStream.getReader();
  const decoder = new TextDecoder();
  let fullContent = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split("\n");
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const json = JSON.parse(line);
        const delta = json.choices?.[0]?.delta?.content || json.choices?.[0]?.text;
        if (delta) {
          fullContent += delta;
          controller.enqueue(encoder.encode(delta));
        }
      } catch {
        controller.enqueue(encoder.encode(chunk));
        break;
      }
    }
  }
  return fullContent;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const conversation = db.select().from(schema.conversations)
    .where(eq(schema.conversations.id, id))
    .get();

  if (!conversation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (conversation.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ── Parse multipart form data ─────────────────────────────────────────────
  const formData = await request.formData();
  const content = (formData.get("content") as string | null) ?? "";
  const providerId = (formData.get("providerId") as string | null) || undefined;
  const modelId = (formData.get("modelId") as string | null) || undefined;
  const searchEnabled = formData.get("searchEnabled") === "true";
  const files = formData.getAll("files") as File[];

  if (!content.trim() && files.length === 0) {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }

  // ── Process attachments ───────────────────────────────────────────────────
  type ImageAttachment = { name: string; mimeType: string; data: string }; // base64 for AI API
  let processedContent = content;
  const imageAttachments: ImageAttachment[] = [];

  const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
  const MAX_PDF_BYTES   = 20 * 1024 * 1024; // 20 MB
  const MAX_SHEET_BYTES = 10 * 1024 * 1024; // 10 MB

  for (const file of files) {
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    const isImage = file.type.startsWith("image/");
    const sizeLimit = isPdf ? MAX_PDF_BYTES : isImage ? MAX_IMAGE_BYTES : MAX_SHEET_BYTES;
    const sizeLabelMB = sizeLimit / (1024 * 1024);

    if (file.size > sizeLimit) {
      processedContent += `\n\n[${file.name} — skipped, exceeds ${sizeLabelMB} MB limit]`;
      continue;
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (file.type.startsWith("image/")) {
      imageAttachments.push({
        name: file.name,
        mimeType: file.type,
        data: buffer.toString("base64"),
      });
    } else if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      // PDF — extract text server-side, fall back to OCR for scanned/image-based PDFs
      try {
        // Validate it's actually a PDF before parsing
        const header = buffer.slice(0, 5).toString("ascii");
        if (!header.startsWith("%PDF")) {
          throw new Error(`Invalid PDF header: "${header}" — buffer may be corrupted (size: ${buffer.length} bytes)`);
        }
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const pdfFn = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string; numpages: number }>;
        const data = await pdfFn(buffer);
        const extractedText = data.text?.trim() ?? "";

        if (extractedText) {
          // Text-based PDF — use extracted text directly
          processedContent += `\n\n<document filename="${file.name}" pages="${data.numpages}">\n${extractedText}\n</document>`;
        } else {
          // Scanned/image-based PDF — fall back to OCR
          console.log(`[PDF] No text in "${file.name}" (${data.numpages} pages) — running OCR...`);
          try {
            const ocr = await ocrPdfBuffer(buffer);
            if (ocr.text) {
              processedContent += `\n\n<document filename="${file.name}" pages="${ocr.pageCount}" source="ocr">\n${ocr.text}\n</document>`;
            } else {
              processedContent += `\n\n<document filename="${file.name}" pages="${ocr.pageCount}">\n[OCR could not extract readable text from this scanned PDF.]\n</document>`;
            }
          } catch (ocrErr) {
            const ocrMsg = (ocrErr as any)?.message ?? String(ocrErr);
            console.error("[OCR] Failed:", ocrMsg);
            processedContent += `\n\n<document filename="${file.name}" pages="${data.numpages}">\n[This PDF is image-based and OCR failed: ${ocrMsg}]\n</document>`;
          }
        }
      } catch (e) {
        const msg = (e as any)?.message ?? String(e);
        console.error("Failed to parse PDF:", msg);
        processedContent += `\n\n[Attached PDF: ${file.name} — parsing failed: ${msg}]`;
      }
    } else {
      // Spreadsheet — parse to CSV text
      try {
        const xlsxModule = await import("xlsx");
        const XLSX = (xlsxModule as any).default ?? xlsxModule;
        const wb = XLSX.read(buffer, { type: "buffer" });
        let tableText = `\n\n<document filename="${file.name}">`;
        for (const sheetName of wb.SheetNames) {
          const ws = wb.Sheets[sheetName];
          const csv = XLSX.utils.sheet_to_csv(ws);
          tableText += `\n<sheet name="${sheetName}">\n${csv}\n</sheet>`;
        }
        tableText += `\n</document>`;
        processedContent += tableText;
      } catch (e) {
        console.error("Failed to parse spreadsheet:", e);
        processedContent += `\n\n[Attached file: ${file.name} — could not be parsed]`;
      }
    }
  }

  const userId = session.user.id;
  const messageId = uuidv4();
  const now = new Date();

  // Store display-friendly content in DB (original text + file labels)
  const fileLabels = [
    ...files.filter(f => f.type === "application/pdf").map(f => `[PDF: ${f.name}]`),
    ...files.filter(f => !f.type.startsWith("image/") && f.type !== "application/pdf").map(f => `[File: ${f.name}]`),
    ...imageAttachments.map(a => `[Image: ${a.name}]`),
  ].join(" ");
  const storedContent = [content.trim(), fileLabels].filter(Boolean).join("\n") || fileLabels;

  db.insert(schema.messages).values({
    id: messageId,
    conversationId: id,
    role: "user",
    content: storedContent,
    createdAt: now,
  }).run();

  db.update(schema.conversations)
    .set({ updatedAt: now })
    .where(eq(schema.conversations.id, id))
    .run();

  const existingMessages = db.select().from(schema.messages)
    .where(eq(schema.messages.conversationId, id))
    .orderBy(asc(schema.messages.createdAt))
    .all();

  const maxHistorySetting = db.select().from(schema.settings)
    .where(eq(schema.settings.key, "max_history_messages"))
    .get();
  const maxHistory = parseInt(maxHistorySetting?.value || "20", 10);

  const recentMessages = existingMessages.slice(-maxHistory);

  const chatMessages: ChatMessage[] = [];

  if (conversation.systemPrompt) {
    chatMessages.push({ role: "system", content: conversation.systemPrompt });
  }

  const userSettings = db.select().from(schema.userSettings)
    .where(eq(schema.userSettings.userId, userId))
    .get();

  if (userSettings?.systemPromptPrefix) {
    const currentSystem = chatMessages.find((m) => m.role === "system");
    if (currentSystem) {
      currentSystem.content = `${userSettings.systemPromptPrefix}\n\n${currentSystem.content}`;
    } else {
      chatMessages.push({ role: "system", content: userSettings.systemPromptPrefix });
    }
  }

  // Inject today's date so the AI always has correct temporal context
  const todayStr = new Date().toISOString().split("T")[0];
  const dateNote = `Today's date is ${todayStr}.`;
  const existingSystem = chatMessages.find((m) => m.role === "system");
  if (existingSystem) {
    existingSystem.content = `${dateNote}\n\n${existingSystem.content}`;
  } else {
    chatMessages.push({ role: "system", content: dateNote });
  }

  // Resolve provider/model early so it's available for multimodal content building
  const convProvider = providerId || conversation.providerId
    ? db.select().from(schema.providers).where(eq(schema.providers.id, providerId || conversation.providerId!)).get()
    : db.select().from(schema.providers).get();

  const convModel = modelId || conversation.modelId
    ? db.select().from(schema.models).where(eq(schema.models.id, modelId || conversation.modelId!)).get()
    : convProvider
      ? db.select().from(schema.models).where(eq(schema.models.providerId, convProvider.id)).get()
      : null;

  if (!convProvider || !convModel) {
    return NextResponse.json({ error: "No provider or model configured" }, { status: 400 });
  }

  // forceSearch = per-conversation toggle: always search regardless of classifier
  // autoSearch  = SearXNG is globally enabled: run classifier on every message
  const forceSearch = searchEnabled ?? conversation.searchEnabled;
  const searxngConfig = await getSearXNGConfig();
  const autoSearch = !!(searxngConfig?.enabled && searxngConfig?.url);
  let searchResults = "";

  if ((forceSearch || autoSearch) && convProvider && convModel) {
    try {
      const searchQuery = forceSearch
        // Force mode: use classifier but fall back to raw content if it says NO_SEARCH
        ? (await extractSearchQuery(content, convProvider, convModel)) ?? content.slice(0, 80)
        // Auto mode: only search if classifier returns a query
        : await extractSearchQuery(content, convProvider, convModel);

      console.log("[Search] query:", searchQuery, "| force:", forceSearch, "| auto:", autoSearch);

      if (searchQuery) {
        const results = await search(searchQuery);
        console.log("[Search] results count:", results.length);
        searchResults = formatSearchResults(results);

        const searchSystemIndex = chatMessages.findIndex((m) => m.role === "system");
        if (searchSystemIndex >= 0) {
          chatMessages[searchSystemIndex].content += `\n\n${searchResults}`;
        } else {
          chatMessages.push({ role: "system", content: searchResults });
        }
      }
    } catch (error) {
      console.error("[Search] failed:", error);
    }
  }

  // All history except the last message (which is the current user turn)
  for (const msg of recentMessages.slice(0, -1)) {
    chatMessages.push({
      role: msg.role as "system" | "user" | "assistant",
      content: msg.content,
    });
  }

  // Build the current user message — multimodal if images were attached
  let currentUserContent: ChatMessage["content"] = processedContent;

  if (imageAttachments.length > 0) {
    if (convProvider?.type === "claude") {
      // Anthropic format
      currentUserContent = [
        ...imageAttachments.map((img) => ({
          type: "image",
          source: { type: "base64", media_type: img.mimeType, data: img.data },
        })),
        { type: "text", text: processedContent || "What do you see?" },
      ];
    } else {
      // OpenAI-compatible format
      currentUserContent = [
        { type: "text", text: processedContent || "What do you see?" },
        ...imageAttachments.map((img) => ({
          type: "image_url",
          image_url: { url: `data:${img.mimeType};base64,${img.data}` },
        })),
      ];
    }
  }

  chatMessages.push({ role: "user", content: currentUserContent });

  const encoder = new TextEncoder();
  const aiMessageId = uuidv4();

  const stream = new ReadableStream({
    async start(controller) {
      let fullContent = "";
      let usedProvider = convProvider;
      let usedModel = convModel;

      try {
        const aiStream = await streamChat({ provider: convProvider, model: convModel, messages: chatMessages, stream: true });
        fullContent = await pipeAIStream(aiStream, controller, encoder);
      } catch (primaryError: any) {
        console.error("Stream error (primary):", primaryError);

        // Attempt fallback to a different enabled model
        if (isRecoverableError(primaryError)) {
          try {
            const allModels = db.select().from(schema.models).where(eq(schema.models.enabled, true)).all();
            const allProviders = db.select().from(schema.providers).where(eq(schema.providers.enabled, true)).all();
            const fallback = allModels
              .filter((m) => m.id !== convModel.id)
              .map((m) => ({ model: m, provider: allProviders.find((p) => p.id === m.providerId) }))
              .find((x) => x.provider);

            if (fallback?.provider) {
              usedProvider = fallback.provider;
              usedModel = fallback.model;
              const note = `> ⚠️ ${convModel.displayName || convModel.modelId} unavailable — retrying with **${fallback.model.displayName || fallback.model.modelId}**.\n\n`;
              controller.enqueue(encoder.encode(note));
              const fallbackStream = await streamChat({ provider: fallback.provider, model: fallback.model, messages: chatMessages, stream: true });
              fullContent = note + await pipeAIStream(fallbackStream, controller, encoder);
            } else {
              throw primaryError; // no fallback available
            }
          } catch (fallbackError: any) {
            console.error("Stream error (fallback):", fallbackError);
            const msg = fallbackError?.message || "Unknown error";
            const errText = `\n\n[Error: ${msg}]`;
            controller.enqueue(encoder.encode(errText));
            fullContent = errText;
          }
        } else {
          const msg = primaryError?.message || "Unknown error";
          const errText = `\n\n[Error: ${msg}]`;
          controller.enqueue(encoder.encode(errText));
          fullContent = errText;
        }
      }

      // Always persist the result (including errors) so the bubble doesn't vanish
      if (fullContent) {
        db.insert(schema.messages).values({
          id: aiMessageId,
          conversationId: id,
          role: "assistant",
          content: fullContent,
          createdAt: new Date(),
        }).run();
      }

      db.update(schema.conversations)
        .set({ updatedAt: new Date() })
        .where(eq(schema.conversations.id, id))
        .run();

      controller.close();

      // Generate title in background (skip if response was an error)
      if (fullContent && !fullContent.startsWith("\n\n[Error:") && (!conversation.title || conversation.title === "New Conversation")) {
        (async () => {
          try {
            const decoder2 = new TextDecoder();
            const cleanedResponse = fullContent.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
            const titleStream = await streamChat({
              provider: usedProvider,
              model: usedModel,
              messages: [
                {
                  role: "system",
                  content: "You generate concise chat titles. Return ONLY the title — no quotes, no punctuation at the end, no explanation. 4–6 words that describe the topic of the conversation, not the answer.",
                },
                {
                  role: "user",
                  content: `User asked: ${content}\nAssistant answered: ${cleanedResponse.slice(0, 300)}`,
                },
              ],
              stream: false,
            });

            const titleReader = titleStream.getReader();
            let title = "";
            let titleBuffer = "";
            while (true) {
              const { done, value } = await titleReader.read();
              if (done) break;
              titleBuffer += decoder2.decode(value, { stream: true });
              const titleLines = titleBuffer.split("\n");
              titleBuffer = titleLines.pop() || "";
              for (const line of titleLines) {
                if (!line.trim()) continue;
                try {
                  const json = JSON.parse(line);
                  const c = json.choices?.[0]?.delta?.content || json.choices?.[0]?.text;
                  if (c) title += c;
                } catch { /* skip */ }
              }
            }
            title = title.replace(/<think>[\s\S]*?<\/think>/g, "").trim().slice(0, 100);
            if (title) {
              db.update(schema.conversations).set({ title }).where(eq(schema.conversations.id, id)).run();
            }
          } catch (titleError) {
            console.error("Title generation failed:", titleError);
          }
        })();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
