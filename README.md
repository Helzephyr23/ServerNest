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

- **🖥️ Server Management** — Create, start, stop, restart, and clone Minecraft servers
- **📦 Mod Marketplace** — Browse, install, and batch-install mods/plugins from Modrinth
- **🔄 Mod Updates** — Check for mod updates and update with one click
- **🌐 Multi-Node Cluster** — Manage servers across multiple machines from one dashboard
- **📊 Live Metrics** — CPU, RAM, and player count monitoring per server with historical graphs
- **💾 Backups** — Create, restore, download, and schedule backups with rotation
- **☁️ Cloud Storage** — Sync backups to S3, Google Drive, or Dropbox
- **🔧 Live Console** — Real-time console output and command input via xterm.js + Socket.IO
- **👥 Player Management** — Whitelist, OP, and ban management
- **📁 File Manager** — Browse, edit, upload, and download files inside your server container
- **⏰ Scheduled Tasks** — Cron-based backup, restart, stop, start, and command tasks
- **🔐 Two-Factor Auth** — TOTP-based 2FA with QR code setup and recovery
- **👤 Multi-User** — Role-based access control (admin/operator/user) with session management
- **📝 Audit Log** — Track all administrative actions with full history
- **🔔 Notifications** — Discord webhook alerts with enable/disable toggle
- **🛡️ Rate Limiting** — DB-configurable per-route rate limits
- **🔍 Server Search** — Filter servers by status, name, or software
- **🎨 Server Profiles** — Custom description and icon for each server
- **🐳 Docker Isolation** — Each server runs in its own Docker container
- **🔒 Secure** — JWT auth, Argon2 hashing, Helmet headers, SSRF protection, account lockout
- **🌓 Dark Mode** — System-aware theme with manual light/dark toggle
- **🎯 Loading Bar** — Purple route progress indicator on navigation
- **📱 Responsive** — Mobile-friendly layouts throughout the dashboard
- **📥 Server Import** — Import existing servers from zip/tar.gz archives
- **🔄 Server Version Updates** — Update Minecraft version with safety checks
- **📋 Templates** — Pre-configured server profiles (Vanilla, Paper, Fabric, Forge, etc.)

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

- Node.js >= 20 (CI runs on Node 22)
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
| `pnpm --filter @biryani/api run test:coverage` | Run API tests with coverage |

### Testing

Tests use [Vitest](https://vitest.dev/) and run against in-memory SQLite databases with mocked Docker/external services. E2E tests use [Playwright](https://playwright.dev/).

```bash
pnpm test              # Run all unit/integration tests
pnpm test:watch        # Watch mode
```

**Test structure:**

```
src/__tests__/
├── helpers.ts                      # Shared test utilities (createTestDb, seedServer, mockDocker)
├── schema.ts                       # Test DB schema (single source of truth)
├── services/
│   ├── auth.service.test.ts        # User creation, login, 2FA, password verification
│   ├── server.service.test.ts      # Server CRUD, config, port allocation, lifecycle
│   ├── backup.service.test.ts      # Backup create, restore, delete, rotation
│   ├── node.service.test.ts        # Node CRUD, heartbeat, stale detection
│   ├── schedule.service.test.ts    # Task scheduling, cron parsing
│   ├── template.service.test.ts    # Server template lookup
│   ├── notification.service.test.ts  # Discord webhook notifications
│   └── validate.test.ts            # Input validation (Zod schemas)
├── routes/
│   ├── api.integration.test.ts     # Full API integration tests (auth + server routes)
│   └── e2e.integration.test.ts     # End-to-end lifecycle scenarios
└── web/
    ├── login.test.tsx              # Login form rendering, TOTP, error handling
    ├── auth-context.test.tsx       # Auth context provider behavior
    └── dashboard-guard.test.tsx    # Dashboard route protection

web/e2e/
├── login.spec.ts                   # Playwright: login form, invalid login, redirects
└── dashboard.spec.ts               # Playwright: navigation, server creation, templates
```

---

## Project Structure

```
biryani/
├── src/                              # Fastify API backend
│   ├── index.ts                      # Entry point, route registration, Socket.IO setup
│   ├── config/
│   │   ├── database.ts               # SQLite setup + 16 table migrations
│   │   ├── docker.ts                 # Dockerode client + helpers
│   │   └── env.ts                    # Environment variable loading + validation
│   ├── middleware/
│   │   ├── auth.ts                   # JWT authentication, admin, operator middleware
│   │   ├── validate.ts               # Zod schema validation + all schema definitions
│   │   └── rate-limit.ts             # DB-backed rate limiting with wildcard matching
│   ├── routes/
│   │   ├── auth.ts                   # Login, setup, 2FA, logout
│   │   ├── servers.ts                # Server CRUD, lifecycle, config, metrics, import
│   │   ├── backups.ts                # Backup CRUD + restore + download
│   │   ├── files.ts                  # In-container file browser + upload/download
│   │   ├── mods.ts                   # Modrinth search, install, update, batch
│   │   ├── nodes.ts                  # Multi-node agent management
│   │   ├── players.ts                # Whitelist/ops/bans management
│   │   ├── schedule.ts               # Cron-based scheduled tasks
│   │   ├── templates.ts              # Pre-configured server profiles
│   │   ├── notifications.ts          # Discord webhook notification config
│   │   ├── users.ts                  # User CRUD + role management
│   │   ├── overview.ts               # Dashboard overview data
│   │   ├── cloud-storage.ts          # S3/Google Drive/Dropbox config
│   │   ├── rate-limits.ts            # Rate limit rule management
│   │   ├── sessions.ts               # Session listing + revocation
│   │   └── audit.ts                  # Audit log viewing
│   ├── services/
│   │   ├── auth.service.ts           # User management, JWT, TOTP, account lockout
│   │   ├── server.service.ts         # Server lifecycle, config, port allocation
│   │   ├── backup.service.ts         # Backup create/restore/delete with rotation
│   │   ├── modrinth.service.ts       # Modrinth API client
│   │   ├── node.service.ts           # Node agent communication + status tracking
│   │   ├── metrics.service.ts        # Docker container metrics collection
│   │   ├── schedule.service.ts       # Cron scheduling engine
│   │   ├── template.service.ts       # Server template definitions
│   │   ├── notification.service.ts   # Discord webhook + SSRF protection
│   │   ├── cloud-storage.service.ts  # S3/Google Drive/Dropbox integration
│   │   └── audit.service.ts          # Audit log CRUD
│   ├── utils/
│   │   ├── container.ts              # execInContainer / writeInContainer helpers
│   │   ├── mc-version.ts             # Minecraft version utilities
│   │   └── logger.ts                 # Logger utility
│   └── __tests__/                    # Test suite (Vitest)
├── web/                              # Next.js frontend
│   ├── app/
│   │   ├── page.tsx                  # Landing/redirect
│   │   ├── login/page.tsx            # Login form + TOTP
│   │   ├── setup/page.tsx            # First-time admin setup
│   │   └── dashboard/
│   │       ├── layout.tsx            # Sidebar + auth guard + error boundary
│   │       ├── page.tsx              # Dashboard overview (server cards)
│   │       ├── servers/              # Server list, create, import
│   │       │   └── [id]/             # Server detail pages
│   │       │       ├── page.tsx      # Server overview
│   │       │       ├── console/      # Live console (xterm.js)
│   │       │       ├── files/        # File manager
│   │       │       ├── backups/      # Backup management
│   │       │       ├── players/      # Whitelist/ops/bans
│   │       │       ├── settings/     # Server config
│   │       │       ├── mods/         # Mod management
│   │       │       ├── performance/  # CPU/RAM graphs (Recharts)
│   │       │       └── cloud-storage/ # Cloud backup config
│   │       ├── marketplace/          # Modrinth mod browser
│   │       ├── nodes/                # Multi-node management
│   │       ├── users/                # User management (admin)
│   │       ├── templates/            # Server templates
│   │       ├── tasks/                # Scheduled tasks
│   │       ├── notifications/        # Notification config
│   │       ├── settings/             # Global settings (rate limits)
│   │       ├── sessions/             # Active session management
│   │       ├── audit/                # Audit log viewer
│   │       └── rate-limits/          # Rate limit rule management
│   ├── components/
│   │   ├── ui/                       # shadcn/ui components (button, card, input, skeleton)
│   │   ├── sidebar.tsx               # Dashboard sidebar navigation
│   │   ├── theme-provider.tsx        # next-themes provider wrapper
│   │   ├── theme-toggle.tsx          # Light/dark toggle button
│   │   ├── toast.tsx                 # Toast notification component
│   │   ├── confirm-dialog.tsx        # Confirmation dialog provider + hook
│   │   ├── error-boundary.tsx        # React error boundary
│   │   └── route-progress.tsx        # NProgress purple loading bar
│   ├── e2e/                          # Playwright E2E tests
│   │   ├── login.spec.ts
│   └── lib/
│       ├── api.ts                    # API client wrapper
│       └── auth.tsx                  # Auth context provider
├── agent/                            # Express agent for remote nodes
│   └── src/
│       ├── app.ts                    # Agent endpoints (health, metrics, containers)
│       └── index.ts                  # Agent entry point
├── Dockerfile                        # Multi-stage production build
├── docker-compose.yml                # Single-service deployment
├── .env.example                      # Environment variable template
├── pnpm-workspace.yaml               # Workspace config + dependency overrides
└── package.json                      # Root workspace scripts
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
8. **Scheduled tasks** run via cron-parser, triggering backups, restarts, commands, and notifications
9. **Audit log** tracks all administrative actions for compliance and debugging

---

## API Reference

All endpoints are prefixed with `/api` and require JWT authentication (`Authorization: Bearer <token>`) unless noted.

### Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/auth/setup` | none | Create first admin account (first-run only) |
| `GET` | `/api/auth/status` | none | Check if setup is needed |
| `POST` | `/api/auth/login` | none | Login, returns JWT |
| `POST` | `/api/auth/2fa/challenge` | none | Complete TOTP challenge after login |
| `GET` | `/api/auth/2fa/status` | auth | Get 2FA status |
| `POST` | `/api/auth/2fa/setup` | auth | Generate TOTP secret + QR code |
| `POST` | `/api/auth/2fa/verify` | auth | Verify code and enable 2FA |
| `POST` | `/api/auth/2fa/disable` | auth | Disable 2FA (requires password + code) |
| `GET` | `/api/auth/me` | auth | Get current user + token expiry |
| `POST` | `/api/auth/logout` | none | Revoke session |

### Users

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/users` | admin | List all users |
| `POST` | `/api/users` | admin | Create a user |
| `PUT` | `/api/users/:id/role` | admin | Update user role |
| `PUT` | `/api/users/:id/password` | admin | Reset user password |
| `DELETE` | `/api/users/:id` | admin | Delete user (cannot delete self or last admin) |

### Servers

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/servers` | auth | List all servers |
| `POST` | `/api/servers` | admin | Create a server |
| `GET` | `/api/servers/:id` | auth | Get server by ID |
| `PUT` | `/api/servers/:id` | auth | Update server metadata |
| `DELETE` | `/api/servers/:id` | admin | Delete server + container + data |
| `POST` | `/api/servers/:id/clone` | admin | Clone server |
| `POST` | `/api/servers/:id/start` | operator+ | Start server |
| `POST` | `/api/servers/:id/stop` | operator+ | Stop server |
| `POST` | `/api/servers/:id/restart` | operator+ | Restart server |
| `GET` | `/api/servers/:id/logs` | auth | Get server logs (tail) |
| `POST` | `/api/servers/:id/command` | auth | Send RCON command |
| `GET` | `/api/servers/:id/config` | auth | Get server config (env vars) |
| `PUT` | `/api/servers/:id/config` | admin | Update server config |
| `GET` | `/api/servers/:id/metrics` | auth | Get latest container metrics |
| `GET` | `/api/servers/:id/metrics/history` | auth | Get metrics history (1h/6h/24h/7d) |
| `POST` | `/api/servers/:id/update-version` | auth | Update Minecraft version |
| `POST` | `/api/servers/import` | admin | Import server from zip/tar.gz archive |

### MC Versions

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/mc-versions` | auth | Fetch Mojang version manifest |

### Mods

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/mods/search` | auth | Search Modrinth mods |
| `GET` | `/api/mods/plugins` | auth | Search Modrinth plugins |
| `GET` | `/api/mods/:slug` | auth | Get Modrinth project details |
| `GET` | `/api/mods/:slug/versions` | auth | Get project versions |
| `GET` | `/api/servers/:id/mods` | auth | List installed mods |
| `POST` | `/api/servers/:id/mods/install` | auth | Install single mod |
| `POST` | `/api/servers/:id/mods/install-batch` | auth | Install multiple mods at once |
| `POST` | `/api/servers/:id/mods/check-updates` | auth | Check for mod updates |
| `GET` | `/api/servers/:id/mods/update-count` | auth | Count available updates |
| `POST` | `/api/servers/:id/mods/update/:filename` | auth | Update a specific mod |
| `DELETE` | `/api/servers/:id/mods/:filename` | auth | Uninstall a mod |

### Backups

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/servers/:id/backups` | auth | List backups |
| `POST` | `/api/servers/:id/backups` | auth | Create backup |
| `POST` | `/api/servers/:id/backups/:backupId/restore` | auth | Restore backup |
| `DELETE` | `/api/backups/:backupId` | auth | Delete backup |
| `GET` | `/api/servers/:id/backups/:backupId/download` | auth | Download backup |

### Files

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/servers/:id/files` | auth | List files in container |
| `DELETE` | `/api/servers/:id/files` | auth | Delete file/folder |
| `PUT` | `/api/servers/:id/files/content` | auth | Write file content |
| `POST` | `/api/servers/:id/files/mkdir` | auth | Create directory |
| `POST` | `/api/servers/:id/files/upload` | auth | Upload file to server data dir |
| `GET` | `/api/servers/:id/files/download` | auth | Download file from server data dir |
| `GET` | `/api/servers/:id/properties` | auth | Read server.properties |
| `PUT` | `/api/servers/:id/properties` | operator+ | Write server.properties (optional reload) |

### Players

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/servers/:id/players/whitelist` | auth | List whitelist |
| `POST` | `/api/servers/:id/players/whitelist` | auth | Add to whitelist |
| `DELETE` | `/api/servers/:id/players/whitelist/:name` | auth | Remove from whitelist |
| `GET` | `/api/servers/:id/players/ops` | auth | List ops |
| `POST` | `/api/servers/:id/players/ops` | auth | Add op |
| `DELETE` | `/api/servers/:id/players/ops/:name` | auth | Remove op |
| `GET` | `/api/servers/:id/players/bans` | auth | List bans |
| `POST` | `/api/servers/:id/players/bans` | auth | Ban player |
| `DELETE` | `/api/servers/:id/players/bans/:name` | auth | Unban player |

### Scheduled Tasks

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/tasks` | auth | List all tasks |
| `GET` | `/api/servers/:id/tasks` | auth | List tasks for server |
| `POST` | `/api/servers/:id/tasks` | auth | Create task |
| `PUT` | `/api/tasks/:id` | auth | Update task |
| `DELETE` | `/api/tasks/:id` | auth | Delete task |
| `POST` | `/api/tasks/:id/run` | auth | Manually run task |

### Templates

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/templates` | auth | List all server templates |
| `GET` | `/api/templates/:id` | auth | Get specific template |

### Notifications

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/notifications` | auth | List notification configs |
| `POST` | `/api/notifications` | auth | Create notification config |
| `PUT` | `/api/notifications/:id` | auth | Toggle notification (enable/disable) |
| `DELETE` | `/api/notifications/:id` | auth | Delete notification config |
| `POST` | `/api/notifications/test` | auth | Send test Discord notification |

### Cloud Storage

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/servers/:id/cloud-storage` | auth | List cloud configs |
| `POST` | `/api/servers/:id/cloud-storage` | auth | Create cloud config |
| `PUT` | `/api/servers/:id/cloud-storage/:configId` | auth | Update cloud config |
| `DELETE` | `/api/servers/:id/cloud-storage/:configId` | auth | Delete cloud config |
| `POST` | `/api/servers/:id/cloud-storage/:configId/test` | auth | Test cloud connection |

### Nodes

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/nodes` | auth | List all nodes |
| `GET` | `/api/nodes/:id` | auth | Get node by ID |
| `GET` | `/api/nodes/:id/servers` | auth | Get servers on a node |
| `POST` | `/api/nodes` | admin | Create node |
| `DELETE` | `/api/nodes/:id` | admin | Delete node (cannot delete "master") |
| `POST` | `/api/nodes/:id/heartbeat` | auth | Node heartbeat with metrics |
| `POST` | `/api/nodes/heartbeat` | auth | Agent heartbeat (by API key) |
| `GET` | `/api/nodes/metrics` | auth | Get all node metrics |
| `POST` | `/api/nodes/find-for-server` | auth | Find best node for new server |

### Sessions

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/sessions` | auth | List current user's sessions |
| `DELETE` | `/api/sessions/:id` | auth | Revoke a specific session |
| `POST` | `/api/sessions/revoke-all` | auth | Revoke all sessions (except current) |

### Rate Limits

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/rate-limits` | admin | List rate limit rules |
| `POST` | `/api/rate-limits` | admin | Create rate limit rule |
| `PUT` | `/api/rate-limits/:id` | admin | Update rate limit rule |
| `DELETE` | `/api/rate-limits/:id` | admin | Delete rate limit rule |

### Audit

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/audit` | admin | List audit log entries (paginated) |

### System

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/health` | none | Health check (includes Docker ping) |
| `GET` | `/api/overview` | auth | Dashboard overview (nodes + metrics) |
| `GET` | `/api/metrics` | auth | System metrics |

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PANEL_HOST` | `127.0.0.1` | Panel bind address (`0.0.0.0` for Docker) |
| `PANEL_PORT` | `3000` | Frontend port |
| `API_PORT` | `3001` | API port |
| `JWT_SECRET` | - | **Required.** Secret for JWT tokens (change in production!) |
| `JWT_EXPIRES_IN` | `24h` | Token expiration time |
| `DATABASE_PATH` | `./data/biryani.db` | SQLite database file path |
| `DOCKER_IMAGE` | `itzg/minecraft-server` | Default Docker image for servers |
| `SERVER_PORT_RANGE_START` | `25565` | Start of Minecraft server port range |
| `SERVER_PORT_RANGE_END` | `25665` | End of Minecraft server port range |
| `NODE_NAME` | `master` | Name for this node |
| `NODE_API_KEY` | - | API key for agent authentication |
| `GRPC_PORT` | `50051` | Agent Express port |
| `CORS_ORIGIN` | `false` (prod) | CORS origin. Set to frontend URL in production. |
| `NEXT_PUBLIC_SOCKET_URL` | - | Optional Socket.IO origin override |

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

Backups can be synced to S3-compatible storage, Google Drive, or Dropbox. Configure under **Server → Cloud Storage** tab.

### S3-Compatible (AWS, Backblaze B2, MinIO, DigitalOcean Spaces)

| Field | Required | Description |
|-------|----------|-------------|
| Endpoint | No | Custom S3 endpoint (blank for AWS default) |
| Region | Yes | e.g. `us-east-1` |
| Bucket | Yes | Bucket name |
| Access Key ID | Yes | IAM access key |
| Secret Access Key | Yes | IAM secret key |
| Prefix | No | Path prefix inside bucket |

### Google Drive

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → Create project → **APIs & Services** → **OAuth consent screen**
2. Set app type to **External**, add `.../auth/drive.file` scope
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
