# Lumi - AI Chat

A self-hosted AI chat application built with Next.js. Connect your own API keys for OpenAI, Anthropic, Google, and other providers — your data stays on your server.

## Features

- **Multi-provider support** — OpenAI, Anthropic (Claude), Google Gemini, OpenRouter, Ollama, and more
- **Streaming responses** with stop/resume
- **Message branching** — edit any message and explore alternative responses
- **File attachments** — PDF, spreadsheets, images with OCR support
- **Web search** — SearXNG integration for grounded responses
- **Multi-user** — local authentication with admin and user roles
- **Admin panel** — manage providers, models, users, and settings
- **Mobile-friendly** UI with dark/light mode
- **Self-hosted** with SQLite — no external database needed

---

## Quick Start with Docker

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/)

### 1. Clone the repo

```bash
git clone https://github.com/stanleyau-xx/lumi.git
cd lumi
```

### 2. Create your environment file

```bash
cp .env.example .env
```

Edit `.env` with your values (see [Environment Variables](#environment-variables) below).

### 3. Start

```bash
docker compose up -d
```

The app will be available at `http://localhost:3000`.

Log in with the admin credentials you set in `.env`. Then go to **Admin > Providers** to add your AI API keys.

---

## Docker Build

### Build the image manually

```bash
docker build -t lumi .
```

### Run without Docker Compose

```bash
docker run -d \
  -p 3000:3000 \
  -e NEXTAUTH_SECRET=your-secret \
  -e NEXTAUTH_URL=http://localhost:3000 \
  -e ENCRYPTION_KEY=your-32-char-key \
  -e ADMIN_USERNAME=admin \
  -e ADMIN_PASSWORD=changeme \
  -v lumi-data:/app/data \
  --name lumi \
  lumi
```

### Rebuild after code changes

```bash
docker compose down
docker compose up -d --build
```

### Back up your data

All data is stored in a SQLite database inside the container volume. To back it up:

```bash
docker cp lumi:/app/data/db.sqlite ./backup-$(date +%Y%m%d).sqlite
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXTAUTH_SECRET` | Yes | Secret for session signing — generate with `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Yes | Full URL your app is accessible at, e.g. `http://localhost:3000` |
| `ENCRYPTION_KEY` | Yes | Key for encrypting stored API secrets — generate with `openssl rand -hex 32` |
| `ADMIN_USERNAME` | Yes | Admin account username (created on first run) |
| `ADMIN_PASSWORD` | Yes | Admin account password |
| `DATABASE_URL` | No | SQLite path (default: `file:/app/data/db.sqlite`) |

> AI provider API keys (OpenAI, Anthropic, etc.) are added through the admin panel — not via environment variables.

---

## Deploying with Portainer

1. Go to **Stacks > Add stack**
2. Paste the contents of `docker-compose.yml`
3. Add the required environment variables in the UI
4. Deploy the stack

---

## Local Development

### Prerequisites

- Node.js 20+
- npm

### Setup

```bash
npm install
npm run dev       # starts on http://localhost:3001
```

### Useful commands

```bash
npm run build       # production build
npm run typecheck   # TypeScript type check
npm run lint        # ESLint
npm run db:studio   # Drizzle DB browser UI
```

---

## Adding AI Providers

1. Log in as admin and go to **Admin > Providers**
2. Click **Add Provider** and select the type
3. Enter your API key
4. Go to **Admin > Models**, click **Fetch Models**, then enable the ones you want

Supported providers include OpenAI, Anthropic, Google Gemini, OpenRouter, MiniMax, and any OpenAI-compatible endpoint (e.g. Ollama, LM Studio).

---

## Web Search (SearXNG)

1. Set up a [SearXNG](https://searxng.github.io/searxng/) instance (can run on the same NAS)
2. Enable JSON output format in SearXNG settings
3. In Lumi: **Admin > Search**, enter your SearXNG URL and test the connection

---

## Tech Stack

- **Framework** — Next.js 15 (App Router)
- **Language** — TypeScript
- **Database** — SQLite via better-sqlite3 + Drizzle ORM
- **Auth** — NextAuth.js
- **UI** — Tailwind CSS + shadcn/ui
- **AI** — Vercel AI SDK, OpenAI SDK, Anthropic SDK
- **Deployment** — Docker (multi-stage build)

---

## License

MIT
