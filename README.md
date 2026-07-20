<div align="center">

# 🍛 Biryani

**Free, self-hosted Minecraft server management panel**

[![License: GPLv3](https://img.shields.io/badge/license-GPLv3-blue.svg?style=flat-square)](LICENSE)
[![Docker](https://img.shields.io/badge/docker-ready-2496ED?style=flat-square&logo=docker&logoColor=white)](#quick-start)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-339933?style=flat-square&logo=node.js&logoColor=white)](#quick-start)

</div>

---

Biryani is a **free, open-source, self-hosted** Minecraft server management panel with a modern UI, built-in mod marketplace, and multi-node clustering.

### Screenshots

> Screenshots coming soon — the project is in its initial release. We'd love to see your deployments!

### Features

- **🖥️ Server Management** — Create, start, stop, restart Minecraft servers with one click
- **📦 Mod Marketplace** — Browse and discover mods/plugins from Modrinth directly in the panel
- **🌐 Multi-Node Cluster** — Manage servers across multiple machines from one dashboard
- **📊 Live Metrics** — CPU, RAM, and player count monitoring per server
- **💾 Backups** — Create, restore, and download server backups
- **🔧 Live Console** — Real-time console output and command input via xterm.js + Socket.IO
- **👥 Player Management** — Whitelist, OP, and ban management
- **📁 File Manager** — Browse, edit, upload, and download files inside your server container
- **⏰ Scheduled Tasks** — Cron-based backup, restart, stop, start, and command tasks
- **🐳 Docker Isolation** — Each server runs in its own Docker container
- **🔒 Secure** — JWT authentication with Argon2 password hashing, rate limiting, input validation
- **🌓 Dark Mode** — System-aware theme with manual light/dark toggle
- **👤 User Management** — Multi-user support with admin/user roles and permission control
- **🎨 Modern UI** — Built with Next.js 15, Tailwind CSS, and shadcn/ui

### Supported Software

| Software | Status |
|----------|--------|
| Vanilla | ✅ |
| Paper | ✅ |
| Spigot | ✅ |
| Forge | ✅ |
| Fabric | ✅ |
| Purpur | ✅ |
| Bedrock | ✅ (via Docker) |

---

## Quick Start

### Docker Compose (Recommended)

```bash
git clone https://github.com/Helzephyr23/biryani.git
cd biryani
cp .env.example .env
# Edit .env — set a secure JWT_SECRET
docker compose up -d
```

Open **http://localhost:3000** and follow the setup wizard to create your admin account.

### Manual Setup

**Requirements:** Node.js 20+, [pnpm](https://pnpm.io), Docker

```bash
git clone https://github.com/Helzephyr23/biryani.git
cd biryani
pnpm install
cp .env.example .env
# Edit .env — set a secure JWT_SECRET
pnpm dev
```

Open **http://localhost:3000** for the frontend and **http://localhost:3001** for the API.

---

## Development

### Prerequisites

- Node.js >= 20
- pnpm 9.x
- Docker (for running Minecraft servers)

### Setup

```bash
pnpm install
cp .env.example .env
```

### Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start API + frontend in development mode |
| `pnpm build` | Build both API and frontend for production |
| `pnpm start` | Start production server |
| `pnpm test` | Run all tests |
| `pnpm test:watch` | Run tests in watch mode |
| `pnpm lint` | Lint all packages |
| `pnpm typecheck` | Type-check all packages |

### Testing

Tests use [Vitest](https://vitest.dev/) and run against in-memory SQLite databases with mocked Docker/external services.

```bash
pnpm test           # Run all tests
pnpm test:watch     # Watch mode
```

**Test structure:**

```
src/__tests__/
├── helpers.ts                    # Shared test utilities (createTestDb, seedServer, mockDocker)
├── services/
│   ├── auth.service.test.ts      # User creation, login, password verification
│   ├── server.service.test.ts    # Server CRUD, config, port allocation
│   ├── backup.service.test.ts    # Backup create, restore, delete
│   ├── node.service.test.ts      # Node CRUD, heartbeat, stale detection
│   ├── schedule.service.test.ts  # Task scheduling, cron parsing
│   ├── template.service.test.ts  # Server template lookup
│   ├── notification.service.test.ts  # Discord/email notifications
│   └── validate.test.ts          # Input validation (Zod schemas)
└── routes/
    └── api.integration.test.ts   # Full API integration tests (auth + server routes)
```

---

## Project Structure

```
biryani/
├── src/                          # Fastify API backend
│   ├── index.ts                  # Entry point, route registration, Socket.IO setup
│   ├── config/
│   │   ├── database.ts           # SQLite setup + migrations
│   │   ├── docker.ts             # Dockerode client + helpers
│   │   └── env.ts                # Environment variable loading
│   ├── middleware/
│   │   ├── auth.ts               # JWT authentication middleware
│   │   ├── validate.ts           # Zod schema validation
│   │   └── rate-limit.ts         # Per-route rate limiting
│   ├── routes/
│   │   ├── auth.ts               # Login, setup, token refresh
│   │   ├── servers.ts            # Server CRUD + lifecycle (start/stop/restart)
│   │   ├── backups.ts            # Backup CRUD + restore
│   │   ├── files.ts              # In-container file browser (ls/cat/write/mkdir/rm)
│   │   ├── mods.ts               # Modrinth search + install
│   │   ├── nodes.ts              # Multi-node agent management
│   │   ├── players.ts            # Whitelist/ops/bans management
│   │   ├── schedule.ts           # Cron-based scheduled tasks
│   │   ├── templates.ts          # Pre-configured server profiles
│   │   ├── notifications.ts      # Discord/email notification config
│   │   └── users.ts              # User CRUD + role management
│   ├── services/
│   │   ├── auth.service.ts       # User creation, JWT signing, password hashing
│   │   ├── server.service.ts     # Server lifecycle, config, port allocation
│   │   ├── backup.service.ts     # Backup create/restore/delete with rotation
│   │   ├── modrinth.service.ts   # Modrinth API client
│   │   ├── node.service.ts       # Node agent communication + status tracking
│   │   ├── schedule.service.ts   # Cron scheduling engine
│   │   ├── template.service.ts   # Server template definitions
│   │   ├── notification.service.ts   # Discord webhook + email alerts
│   │   └── metrics.service.ts    # System metrics collection
│   ├── agent/
│   │   └── index.ts              # Express agent for remote nodes (port 50051)
│   └── __tests__/                # Test suite (Vitest)
├── web/                          # Next.js frontend
│   ├── app/
│   │   ├── page.tsx              # Landing/redirect
│   │   ├── login/page.tsx        # Login form
│   │   ├── setup/page.tsx        # First-time admin setup
│   │   └── dashboard/
│   │       ├── layout.tsx        # Sidebar + auth guard
│   │       ├── page.tsx          # Dashboard overview
│   │       ├── servers/          # Server list, create, detail pages
│   │       ├── marketplace/      # Modrinth mod browser
│   │       ├── nodes/            # Multi-node management
│   │       └── users/            # User management panel
│   ├── components/
│   │   ├── ui/                   # shadcn/ui components
│   │   ├── theme-provider.tsx    # next-themes provider wrapper
│   │   └── theme-toggle.tsx      # Light/dark toggle button
│   └── lib/
│       ├── api.ts                # API client wrapper
│       └── auth.tsx              # Auth context provider
├── Dockerfile                    # Multi-stage production build
├── docker-compose.yml            # Single-service deployment
├── .env.example                  # Environment variable template
└── package.json                  # Root workspace scripts
```

---

## Architecture

```
┌──────────────────────────────────────────┐
│              Biryani Panel                │
│  ┌──────────────┐  ┌──────────────────┐  │
│  │   Next.js    │  │     Fastify      │  │
│  │   Frontend   │◄─┤      API         │  │
│  │   :3000      │  │     :3001        │  │
│  └──────────────┘  └────────┬─────────┘  │
│                             │             │
│                    ┌────────┴─────────┐   │
│                    │   Docker Mgmt    │   │
│                    │   (dockerode)    │   │
│                    └────────┬─────────┘   │
│                             │             │
│                    ┌────────┴─────────┐   │
│                    │  SQLite (better-  │   │
│                    │   sqlite3)        │   │
│                    └──────────────────┘   │
└─────────────────────────────┼────────────┘
                              │
             ┌────────────────┼────────────────┐
             ▼                ▼                ▼
      ┌────────────┐  ┌────────────┐   ┌────────────┐
      │   Agent    │  │   Agent    │   │   Agent    │
      │  Node 1    │  │  Node 2    │   │  Node 3    │
      │ (Express)  │  │ (Express)  │   │ (Express)  │
      └────────────┘  └────────────┘   └────────────┘
```

### How It Works

1. **Frontend** communicates with the **Fastify API** via REST endpoints
2. The API manages **Minecraft server containers** through Docker (using `dockerode`)
3. Each server runs in an isolated Docker container using the `itzg/minecraft-server` image
4. File operations, player management, and console access run via `docker exec` inside the container
5. **Socket.IO** provides real-time updates (console output, server status changes)
6. **Multi-node support** allows managing servers across multiple machines via Express agents
7. Data is stored in **SQLite** (better-sqlite3) with the database file persisted on disk

---

## API Overview

All API endpoints are prefixed with `/api` and require JWT authentication (via `Authorization: Bearer <token>` header) unless noted.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/setup` | Create first admin account |
| `POST` | `/api/auth/login` | Login (returns JWT) |
| `GET` | `/api/auth/me` | Get current user |
| `GET` | `/api/auth/status` | Check if setup needed |
| `GET` | `/api/users` | List all users |
| `POST` | `/api/users` | Create a user |
| `PUT` | `/api/users/:id/role` | Update user role |
| `PUT` | `/api/users/:id/password` | Reset user password |
| `DELETE` | `/api/users/:id` | Delete a user |
| `GET` | `/api/servers` | List all servers |
| `POST` | `/api/servers` | Create a server |
| `GET` | `/api/servers/:id` | Get server details |
| `PUT` | `/api/servers/:id` | Update server |
| `DELETE` | `/api/servers/:id` | Delete server |
| `POST` | `/api/servers/:id/start` | Start server |
| `POST` | `/api/servers/:id/stop` | Stop server |
| `POST` | `/api/servers/:id/restart` | Restart server |
| `GET` | `/api/servers/:id/properties` | Read server.properties |
| `PUT` | `/api/servers/:id/properties` | Update server.properties |
| `GET` | `/api/servers/:id/files?path=` | List files in container |
| `GET` | `/api/servers/:id/files/content?path=` | Read file content |
| `PUT` | `/api/servers/:id/files/content` | Write file content |
| `POST` | `/api/servers/:id/files/mkdir` | Create directory |
| `DELETE` | `/api/servers/:id/files?path=` | Delete file/directory |
| `GET` | `/api/servers/:id/backups` | List backups |
| `POST` | `/api/servers/:id/backups` | Create backup |
| `POST` | `/api/servers/:id/backups/:id/restore` | Restore backup |
| `DELETE` | `/api/backups/:id` | Delete backup |
| `GET` | `/api/servers/:id/mods/search?q=&facets=` | Search Modrinth |
| `POST` | `/api/servers/:id/mods/install` | Install mod |
| `GET/POST/DELETE` | `/api/servers/:id/players/whitelist` | Whitelist management |
| `GET/POST/DELETE` | `/api/servers/:id/players/ops` | Ops management |
| `GET/POST/DELETE` | `/api/servers/:id/players/bans` | Ban management |
| `GET` | `/api/nodes` | List nodes |
| `POST` | `/api/nodes` | Add node |
| `POST` | `/api/nodes/heartbeat` | Agent heartbeat |
| `GET` | `/api/metrics` | System metrics |
| `GET` | `/api/health` | Health check (no auth) |

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PANEL_HOST` | `127.0.0.1` | Panel bind address (`0.0.0.0` for Docker) |
| `PANEL_PORT` | `3000` | Frontend port |
| `API_PORT` | `3001` | API port |
| `JWT_SECRET` | - | **Required.** Secret for JWT tokens (change in production!) |
| `JWT_EXPIRES_IN` | `24h` | Token expiration time |
| `CORS_ORIGIN` | `false` (prod) | Allowed CORS origin. Set to frontend URL (e.g. `https://panel.example.com`) in production. Disables CORS entirely when `false`. |
| `DATABASE_PATH` | `./data/biryani.db` | SQLite database file path |
| `DOCKER_IMAGE` | `itzg/minecraft-server` | Default Docker image for servers |
| `SERVER_PORT_RANGE_START` | `25565` | Start of Minecraft server port range |
| `SERVER_PORT_RANGE_END` | `25665` | End of Minecraft server port range |
| `NODE_NAME` | `master` | Name for this node |
| `NODE_API_KEY` | - | API key for agent authentication |
| `GRPC_PORT` | `50051` | Agent gRPC/Express port |
| `NEXT_PUBLIC_API_URL` | `http://127.0.0.1:3001` | Frontend API base URL (used by the web container) |

---

## Multi-Node Setup

1. Deploy the agent on each remote machine:

```bash
cd agent
cp .env.example .env
# Set NODE_API_KEY to a shared secret
pnpm install && pnpm start
```

2. Register the node in the panel under **Nodes > Add Node**

3. Assign servers to specific nodes when creating them

---

## Cloud Storage Setup

Backups can be synced to S3-compatible storage, Google Drive, or Dropbox. Configure under **Server → Cloud Storage** tab after adding a server.

### S3-Compatible (AWS, Backblaze B2, MinIO, DigitalOcean Spaces, etc.)

| Field | Required | Description |
|-------|----------|-------------|
| Endpoint | No | Custom S3 endpoint (blank for AWS default) |
| Region | Yes | e.g. `us-east-1` |
| Bucket | Yes | Bucket name |
| Access Key ID | Yes | IAM access key or equivalent |
| Secret Access Key | Yes | IAM secret key or equivalent |
| Prefix | No | Path prefix inside bucket (e.g. `biryani/servers/`) |

### Google Drive

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → Create a project → **APIs & Services** → **OAuth consent screen**
2. Set app type to **External** (or Internal if using Google Workspace), add the `.../auth/drive.file` scope
3. Go to **Credentials** → **Create Credentials** → **OAuth client ID** → **Desktop app**
4. Copy the **Client ID** and **Client Secret**
5. Generate a refresh token:

```
https://accounts.google.com/o/oauth2/v2/auth?
  client_id=YOUR_CLIENT_ID&
  redirect_uri=urn:ietf:wg:oauth:2.0:oob&
  response_type=code&
  scope=https://www.googleapis.com/auth/drive.file
```

Visit the URL, authorize, copy the code, then exchange it:

```
POST https://oauth2.googleapis.com/token
  client_id=...
  client_secret=...
  code=THE_CODE
  grant_type=authorization_code
  redirect_uri=urn:ietf:wg:oauth:2.0:oob
```

The response includes a `refresh_token` — use that in the config.

| Field | Required | Description |
|-------|----------|-------------|
| Client ID | Yes | OAuth 2.0 client ID |
| Client Secret | Yes | OAuth 2.0 client secret |
| Refresh Token | Yes | Long-lived token (use once) |
| Folder ID | No | Parent folder ID; leave blank to auto-create `BiryaniBackups` |

### Dropbox

1. Go to [Dropbox Developer Console](https://www.dropbox.com/developers/apps) → **Create app**
2. Choose **Scoped access** → **Full Dropbox** or **App folder**
3. Under **Permissions**, enable `files.content.write` and `files.content.read`
4. Generate an **Access token** (short-lived) or use OAuth for a long-lived refresh token

| Field | Required | Description |
|-------|----------|-------------|
| Access Token | Yes | Dropbox API access token |
| Path | No | Folder path inside Dropbox (default `/BiryaniBackups`) |

---

## Contributing

Contributions are welcome! Here's how to get started:

### Project Roadmap

Check **[ROADMAP.md](./ROADMAP.md)** for upcoming features and **[ISSUES.md](./ISSUES.md)** for known bugs and technical debt.

### Getting Started

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/Helzephyr23/biryani.git
   cd biryani
   ```
3. Install dependencies:
   ```bash
   pnpm install
   ```
4. Copy and configure environment:
   ```bash
   cp .env.example .env
   ```
5. Start the development server:
   ```bash
   pnpm dev
   ```

### Making Changes

1. Create a feature branch:
   ```bash
   git checkout -b feature/amazing-feature
   ```
2. Make your changes
3. Run linting and type checking:
   ```bash
   pnpm lint
   pnpm typecheck
   ```
4. Run the test suite:
   ```bash
   pnpm test
   ```
5. Commit your changes with a clear message:
   ```bash
   git commit -m 'Add amazing feature'
   ```
6. Push to the branch:
   ```bash
   git push origin feature/amazing-feature
   ```
7. Open a Pull Request

### Guidelines

- Follow existing code conventions (TypeScript, ESLint rules, existing patterns)
- Write tests for new service functions when possible
- Keep commits focused and messages descriptive
- Update documentation if your change affects the public API or setup process

---

## License

This project is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. See the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Built with love for the Minecraft community**

</div>
