# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM node:20-bookworm AS builder

WORKDIR /app

# Native build tools for better-sqlite3 + canvas (node-canvas)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev libpixman-1-dev \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm ci --legacy-peer-deps --ignore-scripts \
 && npm rebuild better-sqlite3 canvas

COPY . .

# Ensure public dir exists (Next.js requires it)
RUN mkdir -p public

# Build Next.js (standalone output)
RUN npm run build

# ── Stage 2: runtime ──────────────────────────────────────────────────────────
FROM node:20-bookworm AS runner

WORKDIR /app

ENV NODE_ENV=production

RUN apt-get update && apt-get install -y --no-install-recommends \
    gosu \
    libcairo2 libpango-1.0-0 libjpeg62-turbo libgif7 librsvg2-common \
    && rm -rf /var/lib/apt/lists/* \
    && useradd -m -u 1001 -s /bin/bash nextjs

# Next.js standalone bundle
COPY --from=builder --chown=1001:1001 /app/.next/standalone ./
COPY --from=builder --chown=1001:1001 /app/.next/static ./.next/static
COPY --from=builder --chown=1001:1001 /app/public ./public

# Init script for first-start DB setup
COPY --from=builder --chown=1001:1001 /app/scripts/docker-init.js ./scripts/docker-init.js

# Native/runtime modules not bundled by Next.js standalone
COPY --from=builder --chown=1001:1001 /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
COPY --from=builder --chown=1001:1001 /app/node_modules/bindings ./node_modules/bindings
COPY --from=builder --chown=1001:1001 /app/node_modules/file-uri-to-path ./node_modules/file-uri-to-path
COPY --from=builder --chown=1001:1001 /app/node_modules/bcryptjs ./node_modules/bcryptjs

# PDF text extraction
COPY --from=builder --chown=1001:1001 /app/node_modules/pdf-parse ./node_modules/pdf-parse

# Canvas (native Node.js canvas for PDF rendering)
COPY --from=builder --chown=1001:1001 /app/node_modules/canvas ./node_modules/canvas

# PDF.js for server-side page rendering
COPY --from=builder --chown=1001:1001 /app/node_modules/pdfjs-dist ./node_modules/pdfjs-dist

# Tesseract.js OCR engine (WASM-based, no system deps)
COPY --from=builder --chown=1001:1001 /app/node_modules/tesseract.js ./node_modules/tesseract.js
COPY --from=builder --chown=1001:1001 /app/node_modules/tesseract.js-core ./node_modules/tesseract.js-core

# XLSX for spreadsheet parsing
COPY --from=builder --chown=1001:1001 /app/node_modules/xlsx ./node_modules/xlsx

COPY --chown=1001:1001 docker-entrypoint.sh ./
RUN chmod +x ./docker-entrypoint.sh

# Create data directory
RUN mkdir -p /app/data && chown nextjs:nextjs /app/data

# Tesseract.js cache directory for language data
RUN mkdir -p /tmp/tesseract-cache && chown nextjs:nextjs /tmp/tesseract-cache

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["./docker-entrypoint.sh"]
