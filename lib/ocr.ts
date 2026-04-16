import { createWorker, type Worker as TesseractWorker } from "tesseract.js";
import { createCanvas, type Canvas } from "canvas";

interface CanvasPair {
  canvas: Canvas;
  context: ReturnType<Canvas["getContext"]>;
}

function createNodeCanvasFactory(): {
  create: (width: number, height: number) => CanvasPair;
  destroy: (pair: CanvasPair) => void;
} {
  const canvasCache = new Map<number, Canvas>();

  return {
    create(width: number, height: number): CanvasPair {
      const canvas = createCanvas(width, height);
      const context = canvas.getContext("2d");
      return { canvas, context: context as unknown as ReturnType<Canvas["getContext"]> };
    },
    destroy(pair: CanvasPair): void {
      // no-op for canvas; let GC handle it
    },
  };
}

let workerCache: TesseractWorker | null = null;

async function getWorker(): Promise<TesseractWorker> {
  if (!workerCache) {
    workerCache = await createWorker("eng");
  }
  return workerCache;
}

export async function ocrPdfBuffer(
  pdfBuffer: Buffer,
  maxPages = 20
): Promise<{ text: string; pageCount: number }> {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");

  // Disable PDF.js worker threads (not needed in server context)
  pdfjsLib.GlobalWorkerOptions.workerSrc = "";

  const canvasFactory = createNodeCanvasFactory();

  const doc = await pdfjsLib.getDocument({
    data: new Uint8Array(pdfBuffer),
  }).promise;

  const pageCount = doc.numPages;
  const pagesToProcess = Math.min(pageCount, maxPages);

  const worker = await getWorker();
  const pageTexts: string[] = [];

  for (let i = 1; i <= pagesToProcess; i++) {
    const page = await doc.getPage(i);
    // Scale 2x for better OCR accuracy
    const viewport = page.getViewport({ scale: 2.0 });

    const { canvas, context } = canvasFactory.create(viewport.width, viewport.height);

    await page.render({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      canvasContext: context as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      canvas: canvas as any,
      viewport,
    }).promise;

    // Convert canvas to PNG buffer for Tesseract
    const pngBuffer: Buffer = canvas.toBuffer("image/png");
    canvasFactory.destroy({ canvas, context });

    const {
      data: { text },
    } = await worker.recognize(pngBuffer);

    if (text?.trim()) {
      pageTexts.push(text.trim());
    }

    page.cleanup();
  }

  doc.destroy();

  return {
    text: pageTexts.join("\n\n"),
    pageCount,
  };
}
