<<<<<<< HEAD
# Lumi - Self-hosted AI Chat Application

A complete, self-hosted AI chat web application with support for multiple AI providers, web search, and user management.

## Features

- **Multiple AI Providers**: OpenAI, Claude, OpenRouter, MiniMax, MiniMax-CN
- **Web Search**: SearXNG integration for enhanced AI responses
- **User Management**: Local authentication with role-based access (user/admin)
- **Streaming Responses**: Real-time AI responses via SSE
- **Markdown Support**: Code syntax highlighting, LaTeX math rendering
- **Conversation History**: Persistent chat history with search
- **Admin Portal**: Full control over providers, models, and settings
- **Docker Ready**: Easy deployment on Synology NAS or any Docker host

## Quick Start

### Prerequisites

- Node.js 20+
- npm or Docker

### Local Development

1. Clone the repository:
   ```bash
   git clone https://github.com/stanleyau-xx/lumi
   cd lumi
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create environment file:
   ```bash
   cp .env.example .env
   ```

4. Generate an encryption key:
   ```bash
   openssl rand -hex 32
   ```
   Add this to your `.env` file as `ENCRYPTION_KEY=`

5. Run the development server:
   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000)

### Docker Deployment

1. Clone the repository:
   ```bash
   git clone <your-repo>
   cd lumi
   ```

2. Create environment file:
   ```bash
   cp .env.example .env
   ```

3. Edit `.env` with your settings:
   ```
   NEXTAUTH_SECRET=your-secret-here
   NEXTAUTH_URL=http://your-domain.com
   ENCRYPTION_KEY=your-64-char-hex-key
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=your-admin-password
   ```

4. Build and start:
   ```bash
   docker-compose up -d
   ```

5. Access at `http://localhost:3000`

## Synology NAS Setup

### Using Docker Compose (DSM 7+)

1. Install "Docker" package from Synology Package Center

2. SSH into your NAS and navigate to your project folder

3. Create the `.env` file with your settings

4. Run:
   ```bash
   docker-compose up -d
   ```

5. Access at `http://your-nas-ip:3000`

6. (Recommended) Set up Synology Reverse Proxy:
   - Open Control Panel > Application Portal > Reverse Proxy
   - Create a reverse proxy rule to expose port 3000 with your SSL certificate

### Using Portainer

1. Create a new Stack in Portainer

2. Paste your `docker-compose.yml` content

3. Add environment variables:
   - `NEXTAUTH_SECRET`
   - `NEXTAUTH_URL`
   - `ENCRYPTION_KEY`
   - `ADMIN_USERNAME`
   - `ADMIN_PASSWORD`

4. Deploy the stack

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXTAUTH_SECRET` | Yes | Secret for NextAuth.js (generate with `openssl rand -base64 32`) |
| `NEXTAUTH_URL` | Yes | Your deployment URL (e.g., `https://chat.example.com`) |
| `ENCRYPTION_KEY` | Yes | 64-char hex key for encrypting API secrets (generate with `openssl rand -hex 32`) |
| `ADMIN_USERNAME` | Yes | Initial admin username |
| `ADMIN_PASSWORD` | Yes | Initial admin password |
| `DATABASE_URL` | No | SQLite database path (default: `file:./data/db.sqlite`) |

### Adding AI Providers

1. Log in as admin
2. Go to Admin > Providers
3. Click "Add Provider"
4. Select provider type and enter credentials:
   - **OpenAI**: Enter API key
   - **Claude**: Enter API key
   - **OpenRouter**: Enter API key
   - **MiniMax/MiniMax-CN**: Enter API key and base URL (if using CN variant)

### SearXNG Setup

1. Install SearXNG on a server (can be your NAS)
2. Enable JSON output format
3. Go to Admin > Search
4. Enter your SearXNG URL (e.g., `http://192.168.1.x:8080`)
5. Test the connection

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Database**: SQLite via better-sqlite3
- **ORM**: Drizzle ORM
- **Auth**: NextAuth.js v5
- **Styling**: Tailwind CSS + shadcn/ui
- **Streaming**: Vercel AI SDK
- **Deployment**: Docker

## API Routes

### Conversations
- `GET /api/conversations` - List user's conversations
- `POST /api/conversations` - Create new conversation
- `GET /api/conversations/[id]` - Get conversation details
- `PATCH /api/conversations/[id]` - Update conversation
- `DELETE /api/conversations/[id]` - Delete conversation
- `GET /api/conversations/[id]/messages` - Get message history
- `POST /api/conversations/[id]/message` - Send message (streaming)

### Admin
- `GET/POST /api/admin/providers` - List/create providers
- `PATCH/DELETE /api/admin/providers/[id]` - Update/delete provider
- `POST /api/admin/providers/[id]/connect` - OAuth connect
- `POST /api/admin/providers/[id]/test` - Test connection
- `GET /api/admin/models` - List models
- `PATCH /api/admin/models/[id]` - Update model
- `POST /api/admin/models/fetch` - Fetch models from provider
- `GET/PATCH /api/admin/search` - SearXNG config
- `GET/POST /api/admin/users` - List/create users
- `PATCH/DELETE /api/admin/users/[id]` - Update/delete user
- `GET/PATCH /api/admin/settings` - Global settings

## License

MIT
=======
# lumi
Lumi - AI Chat
>>>>>>> c1ac9775d805704f85c6091d1a19452760bc5c25
