declare module "pdf-parse" {
  interface PDFData {
    text: string;
    numpages: number;
    numrender: number;
    info: Record<string, any>;
    metadata: any;
    version: string;
  }
  function pdfParse(
    dataBuffer: Buffer | Uint8Array,
    options?: Record<string, any>
  ): Promise<PDFData>;
  export = pdfParse;
}

declare module "pdfjs-dist/legacy/build/pdf.js" {
  const pdfjsLib: {
    GlobalWorkerOptions: { workerSrc: string };
    getDocument(params: { data: Uint8Array; canvasFactory?: any }): {
      promise: Promise<{
        numPages: number;
        getPage(num: number): Promise<{
          getViewport(params: { scale: number }): { width: number; height: number };
          render(params: { canvasContext: any; viewport: any; canvasFactory?: any }): {
            promise: Promise<void>;
          };
          cleanup(): void;
        }>;
        destroy(): void;
      }>;
    };
  };
  export = pdfjsLib;
}
