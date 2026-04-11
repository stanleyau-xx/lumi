/**
 * Server-side OCR for scanned/image-based PDFs.
 *
 * Flow: PDF buffer → pdfjs-dist renders pages to canvas → tesseract.js OCR → text
 *
 * Uses require() for all CJS packages to avoid ESM/CJS interop issues in Next.js.
 */

// Lazy-loaded singleton Tesseract worker — created on first OCR request, reused thereafter
let workerPromise: Promise<any> | null = null;

function getWorker(): Promise<any> {
  if (workerPromise) return workerPromise;
  workerPromise = (async () => {
    const Tesseract = require("tesseract.js");
    const worker = await Tesseract.createWorker("eng");
    return worker;
  })();
  return workerPromise;
}

/**
 * NodeCanvasFactory — required by pdfjs-dist for rendering in Node.js.
 * Bridges pdfjs-dist's internal canvas creation to the `canvas` npm package.
 */
function createNodeCanvasFactory() {
  const { createCanvas } = require("canvas");

  return {
    create(width: number, height: number) {
      const canvas = createCanvas(width, height);
      const context = canvas.getContext("2d");
      return { canvas, context };
    },
    reset(pair: any, width: number, height: number) {
      pair.canvas.width = width;
      pair.canvas.height = height;
    },
    destroy(pair: any) {
      pair.canvas.width = 0;
      pair.canvas.height = 0;
      pair.canvas = null;
      pair.context = null;
    },
  };
}

/**
 * OCR a PDF buffer — renders each page as an image, then runs Tesseract.
 *
 * @param pdfBuffer - Raw PDF file as a Buffer
 * @param maxPages  - Maximum pages to OCR (default 20)
 * @returns Extracted text and total page count
 */
export async function ocrPdfBuffer(
  pdfBuffer: Buffer,
  maxPages = 20
): Promise<{ text: string; pageCount: number }> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfjsLib = require("pdfjs-dist/legacy/build/pdf.js");

  // Disable PDF.js worker threads (not needed in server context)
  pdfjsLib.GlobalWorkerOptions.workerSrc = "";

  const canvasFactory = createNodeCanvasFactory();

  const doc = await pdfjsLib.getDocument({
    data: new Uint8Array(pdfBuffer),
    canvasFactory,
  }).promise;

  const pageCount = doc.numPages;
  const pagesToProcess = Math.min(pageCount, maxPages);

  const worker = await getWorker();
  const pageTexts: string[] = [];

  for (let i = 1; i <= pagesToProcess; i++) {
    const page = await doc.getPage(i);
    // Scale 2x for better OCR accuracy
    const viewport = page.getViewport({ scale: 2.0 });

    const pair = canvasFactory.create(viewport.width, viewport.height);

    await page.render({
      canvasContext: pair.context,
      viewport,
      canvasFactory,
    }).promise;

    // Convert canvas to PNG buffer for Tesseract
    const pngBuffer: Buffer = pair.canvas.toBuffer("image/png");
    canvasFactory.destroy(pair);

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
