# AGENTS.md - ServerNest Project Context

## Project Overview
**ServerNest** is an open-source, self-hosted Minecraft server management panel (a free, self-hosted alternative to proprietary panels).

## Tech Stack
- **Backend**: Node.js + TypeScript + Fastify (port 3001)
- **Frontend**: Next.js 15 + Tailwind CSS + shadcn/ui (port 3000)
- **Database**: SQLite via better-sqlite3
- **Containers**: Docker (itzg/minecraft-server image)
- **Realtime**: Socket.IO
- **Mod Integration**: Modrinth API
- **Monorepo**: Single package.json at root

## Project Structure
```
servernest/
├── src/                    # Fastify API backend
│   ├── index.ts           # Entry point, registers all routes
│   ├── config/
│   │   ├── database.ts    # SQLite setup + migrations
│   │   └── docker.ts      # Dockerode client
│   ├── middleware/
│   │   └── auth.ts        # JWT auth middleware
│   ├── routes/
│   │   ├── auth.ts        # POST /api/auth/login, /setup, /me
│   │   ├── servers.ts     # CRUD + start/stop/restart
│   │   ├── backups.ts     # Backup CRUD + restore + live progress + scope delete
│   │   ├── cloud-storage.ts # S3/Google Drive/Dropbox config CRUD
│   │   ├── google-drive.ts  # Google OAuth (auth-url/callback/status/disconnect)
│   │   ├── files.ts       # In-container file browser (ls/cat/write/mkdir/rm)
│   │   ├── mods.ts        # Modrinth search + install
│   │   ├── nodes.ts       # Multi-node agent management
│   │   └── players.ts     # Whitelist/ops/bans management
│   ├── services/
│   │   ├── auth.service.ts    # User setup, login, JWT
│   │   ├── server.service.ts  # Server lifecycle (create/start/stop/destroy)
│   │   ├── backup.service.ts  # Backup create/restore/delete (scope: all/local/cloud)
│   │   ├── backup-progress.ts # In-memory progress store (legacy; endpoint reads DB)
│   │   ├── cloud-storage.service.ts # S3/Google Drive/Dropbox; GDrive resumable upload via global fetch; _loadSdk/_setSdkLoader test seam
│   │   ├── modrinth.service.ts # Modrinth API client
│   │   ├── node.service.ts    # Node agent communication
│   │   └── metrics.service.ts # System metrics collection
│   └── agent/
│       └── index.ts       # Express agent for remote nodes (port 50051)
├── web/                    # Next.js frontend
│   ├── app/
│   │   ├── page.tsx        # Landing/redirect
│   │   ├── login/page.tsx  # Login form
│   │   ├── setup/page.tsx  # First-time admin setup
│   │   └── dashboard/
│   │       ├── layout.tsx  # Sidebar + auth guard
│   │       ├── page.tsx    # Dashboard overview
│   │       ├── servers/
│   │       │   ├── page.tsx           # Server list
│   │       │   ├── new/page.tsx       # Create server
│   │       │   └── [id]/
│   │       │       ├── page.tsx       # Server detail (status polling)
│   │       │       ├── console/page.tsx
│   │       │       ├── backups/page.tsx
│   │       │       ├── files/page.tsx
│   │       │       ├── players/page.tsx
│   │       │       ├── settings/page.tsx
│   │       │       └── mods/page.tsx
│   │       ├── marketplace/page.tsx
│   │       └── nodes/page.tsx
│   ├── components/ui/      # shadcn/ui components
│   └── lib/
│       ├── api.ts          # API client wrapper (same-origin, Next proxies /api/*)
│       └── auth.tsx        # Auth context provider
├── Dockerfile              # Multi-stage build
├── docker-compose.yml      # Single servernest service
├── .dockerignore
├── .env.example
└── package.json
```

## API Endpoints
- `POST /api/auth/setup` - Create first admin user
- `POST /api/auth/login` - Login (returns JWT)
- `GET /api/auth/me` - Get current user
- `GET/POST /api/servers` - List/create servers
- `GET/PUT/DELETE /api/servers/:id` - Server CRUD
- `POST /api/servers/:id/start|stop|restart` - Server lifecycle
- `GET /api/servers/:id/properties` - Read server.properties
- `PUT /api/servers/:id/properties` - Update server.properties
- `GET /api/servers/:id/files?path=` - List files in container
- `GET /api/servers/:id/files/content?path=` - Read file content
- `PUT /api/servers/:id/files/content` - Write file content
- `POST /api/servers/:id/files/mkdir` - Create directory
- `DELETE /api/servers/:id/files?path=` - Delete file/folder
- `GET/POST /api/servers/:id/backups` - Backup list/create (async, 202)
- `GET /api/servers/:id/backups/progress` - Live upload progress (DB-backed)
- `POST /api/servers/:id/backups/:id/restore` - Restore backup
- `DELETE /api/backups/:id?scope=all|local|cloud` - Delete backup (default all)
- `GET/POST/PUT/DELETE /api/servers/:id/cloud-storage[/:configId]` - Cloud config CRUD
- `GET/POST/DELETE /api/google-drive/auth-url|callback|status|disconnect` - Google Drive OAuth
- `GET /api/servers/:id/mods/search?q=&facets=` - Search Modrinth
- `POST /api/servers/:id/mods/install` - Install mod
- `GET/POST/DELETE /api/servers/:id/players/whitelist` - Whitelist CRUD
- `GET/POST/DELETE /api/servers/:id/players/ops` - Ops CRUD
- `GET/POST/DELETE /api/servers/:id/players/bans` - Bans CRUD
- `GET /api/nodes` - List nodes
- `POST /api/nodes/heartbeat` - Agent heartbeat
- `GET /api/metrics` - System metrics

## Key Conventions
- Auth: JWT tokens in `Authorization: Bearer <token>` header
- All routes use `authMiddleware` preHandler
- Docker operations via `dockerode` library
- File ops run inside Minecraft containers via `docker exec`
- Frontend uses `api` wrapper from `web/lib/api.ts` (handles auth + errors)
- Frontend uses `useAuth()` hook from `web/lib/auth.tsx` for auth state
- shadcn/ui components in `web/components/ui/`
- `formatBytes` and `formatDate` utils in `web/lib/utils.ts`
- Backup upload progress is persisted to DB (`bytes_uploaded`/`total_bytes` on `backup_uploads`) so progress survives page refresh; Google Drive uploads use a resumable protocol via Node's global `fetch` (not gaxios)

## Development
- `npm run dev` - Start both API and frontend in dev mode
- `npm run build` - Build everything
- `npm start` - Production start
- API validates with Zod schemas
- Frontend uses Next.js App Router with `"use client"` directive

## Server Lifecycle
1. User creates server via dashboard → `server.service.ts` creates Docker container
2. Container uses `itzg/minecraft-server` image with env vars for config
3. Data volume mounted at `/data` inside container
4. Port mapped dynamically from range (25565-25665)
5. File/player/property operations run `docker exec` inside the container
6. Status tracked in SQLite `servers` table (status: stopped/running/error)
