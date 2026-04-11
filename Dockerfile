# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Native build tools for better-sqlite3 + canvas (node-canvas)
RUN apk add --no-cache python3 make g++ \
    cairo-dev pango-dev jpeg-dev giflib-dev librsvg-dev pixman-dev

COPY package.json package-lock.json* ./
RUN npm ci --legacy-peer-deps

COPY . .

# Ensure public dir exists (Next.js requires it)
RUN mkdir -p public

# Build Next.js (standalone output)
RUN npm run build

# ── Stage 2: runtime ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs && \
    apk add --no-cache su-exec \
    cairo pango jpeg giflib librsvg pixman fontconfig freetype

# Next.js standalone bundle
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Init script for first-start DB setup
COPY --from=builder --chown=nextjs:nodejs /app/scripts/docker-init.js ./scripts/docker-init.js

# Native/runtime modules not bundled by Next.js standalone
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/bindings ./node_modules/bindings
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/file-uri-to-path ./node_modules/file-uri-to-path
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/bcryptjs ./node_modules/bcryptjs

# PDF text extraction
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/pdf-parse ./node_modules/pdf-parse

# Canvas (native Node.js canvas for PDF rendering)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/canvas ./node_modules/canvas
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/nan ./node_modules/nan
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/simple-get ./node_modules/simple-get
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/node-addon-api ./node_modules/node-addon-api
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prebuild-install ./node_modules/prebuild-install

# PDF.js for server-side page rendering
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/pdfjs-dist ./node_modules/pdfjs-dist

# Tesseract.js OCR engine (WASM-based, no system deps)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/tesseract.js ./node_modules/tesseract.js
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/tesseract.js-core ./node_modules/tesseract.js-core

# XLSX for spreadsheet parsing
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/xlsx ./node_modules/xlsx

COPY --chown=nextjs:nodejs docker-entrypoint.sh ./
RUN chmod +x ./docker-entrypoint.sh

# Create data directory (ownership will be fixed at runtime by entrypoint)
RUN mkdir -p /app/data

# Tesseract.js cache directory for language data (downloaded on first OCR request)
RUN mkdir -p /tmp/tesseract-cache && chown nextjs:nodejs /tmp/tesseract-cache

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Run as root so the entrypoint can chown the volume-mounted /app/data,
# then su-exec drops to nextjs for the actual server process.
ENTRYPOINT ["./docker-entrypoint.sh"]
