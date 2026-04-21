# Lumi 🤖

![Lumi AI Chat](https://github.com/user-attachments/assets/2d9e1683-5849-4689-aae3-9d7c497e732f)

A self-hosted AI chat platform built with Next.js. Connect your own API keys — OpenAI, Anthropic, Google, OpenRouter, Ollama, and more — so your data stays on your server, not theirs.

---

## Features

- **Multi-provider** 🤝 — OpenAI, Anthropic (Claude), OpenRouter, Ollama, MiniMax, and any OpenAI-compatible endpoint
- **Streaming responses** ⚡ — real-time AI output with stop and resume
- **Message branching** 🌿 — edit any past message and explore alternative replies
- **File attachments** 📎 — PDF, spreadsheets, images (with OCR)
- **Smart web search** 🔍 — SearXNG integration; triggers automatically when a query needs current information
- **Weather widget** 🌤️ — 7-day forecast for any city, live data
- **Multi-user auth** 👥 — admin and user roles, local accounts
- **Admin panel** ⚙️ — manage providers, models, users, and global settings
- **SQLite** 🔒 — no external database needed

---

## Quick Start (Docker)

### 1. Clone

```bash
git clone https://github.com/stanleyau-xx/lumi.git
cd lumi
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` — see [Environment Variables](#environment-variables) below.

### 3. Launch

```bash
docker compose up -d
```

Open `http://localhost:3000` and log in with your admin credentials. Then go to **Admin → Providers** to add your AI API keys.

---

## Docker Commands

```bash
# Build image manually
docker build -t lumi .

# Start
docker compose up -d

# Rebuild after changes
docker compose down && docker compose up -d --build

# Backup database
docker cp lumi:/app/data/db.sqlite ./backup-$(date +%Y%m%d).sqlite
```

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXTAUTH_SECRET` | Session signing secret — `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Full URL of your app, e.g. `http://localhost:3000` |
| `ENCRYPTION_KEY` | Encrypts stored API keys — `openssl rand -hex 32` |
| `ADMIN_USERNAME` | Admin login username |
| `ADMIN_PASSWORD` | Admin login password |
| `DATABASE_URL` | SQLite path (default: `file:/app/data/db.sqlite`) |

> AI API keys are configured through the Admin panel — not in environment variables.

---

## Deploy to Portainer

1. Create a new **Stack**
2. Paste the contents of `docker-compose.yml`
3. Add the environment variables from `.env.example`
4. Deploy

---

## Local Development

Requires **Node.js 24+** and **npm**.

```bash
npm install
npm run dev       # starts on http://localhost:3001
```

Useful dev commands:

```bash
npm run build       # production build
npm run typecheck   # TypeScript check
npm run lint        # ESLint
npm run db:studio   # open Drizzle DB browser
```

---

## Adding Providers and Models

1. Log in as admin → **Admin → Providers**
2. Click **Add Provider**, pick a type, paste your API key
3. Go to **Admin → Models**, click **Fetch Models**
4. Enable the models you want to use

---

## Web Search (SearXNG)

### Run SearXNG with Docker

```bash
docker run -d \
  --name searxng \
  -p 8888:8888 \
  -v $(pwd)/searxng:/etc/searxng \
  -e SEARXNG_BASE_URL="http://localhost:8888" \
  searxng/searxng:latest
```

### Configure SearXNG

Edit `searxng/settings.yml`:

```yaml
search:
  formats:
    - json

server:
  bind_address: "0.0.0.0"
  limiter: false

ui:
  static_use_hash: true
```

Then restart the container:

```bash
docker restart searxng
```

### Verify SearXNG is Running

```bash
curl "http://localhost:8888/search?q=test&format=json"
```

### Connect to Lumi

1. In Lumi: **Admin → Search**
2. Enter your SearXNG URL, e.g. `http://YOUR_SEARXNG_IP:8888`
3. Enable web search

Searches run automatically when a query needs real-time data — no need to ask explicitly.

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Database | SQLite + better-sqlite3 + Drizzle ORM |
| Auth | NextAuth.js |
| UI | Tailwind CSS + shadcn/ui |
| AI SDK | Vercel AI SDK, OpenAI SDK, Anthropic SDK |
| Deploy | Docker (multi-stage build) |

---

## License

MIT
