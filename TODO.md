# ServerNest Development Phases

## Phase 1: Backend Core (Fastify + SQLite) ✅
- [x] Project scaffolding & monorepo setup
- [x] SQLite database with migrations (users, servers, backups, mods, nodes)
- [x] Auth routes (login, setup, JWT middleware)
- [x] Server CRUD routes (create, start, stop, restart, destroy)
- [x] Backup routes (create, restore, delete)
- [x] Modrinth API routes (search, install)
- [x] Node/agent routes (heartbeat, status)
- [x] Metrics service (system stats)
- [x] Docker client config

## Phase 2: Frontend Core (Next.js) ✅
- [x] Landing page + auth flow (login, setup)
- [x] Dashboard layout with sidebar
- [x] Server list + create server page
- [x] Server detail page with status polling
- [x] Console page (placeholder)
- [x] Backups page (full CRUD)
- [x] Files page (full browser with create/delete)
- [x] Players page (whitelist/ops/bans)
- [x] Settings page (server.properties editor)
- [x] Mods/Marketplace page (Modrinth search + install)
- [x] Nodes page
- [x] TypeScript fixes, defensive checks, merge complete

## Phase 3: Real-Time & Docker Integration ✅
- [x] Merge dev→main with TypeScript fixes
- [x] **WebSocket terminal** — xterm.js + Socket.IO for live console
- [x] **Server lifecycle** — actual Docker container create/start/stop/destroy working
- [x] **Real-time server logs** — streaming container logs to console (Docker stream demux)
- [x] **Mod install flow** — download from Modrinth & place mods in container
- [x] **File upload/download** — upload files to container, download world files
- [x] **server.properties** — apply changes + trigger server reload via RCON
- [x] **Player management** — real whitelist/ops/bans via exec in container
- [x] **Socket.IO events** — server status changes pushed to all connected clients

## Phase 4: Advanced Features ✅
- [x] **Multi-node agent** — Express agent with API key auth, server management, metrics
- [x] **Node management UI** — Add/remove nodes, CPU/RAM/disk monitoring bars
- [x] **Scheduled tasks** — Cron-based backup/restart/stop/start/command with UI
- [x] **Server templates** — 11 pre-configured profiles (Vanilla, Paper, Forge, Fabric, etc.)
- [x] **Backup rotation** — Automatic cleanup of old backups (max 10 per server)
- [x] **Resource monitoring** — Per-node CPU/RAM/disk metrics in agent + UI
- [x] **User roles & permissions** — Multi-user support beyond single admin
- [x] **Notification system** — Discord webhook alerts for server events

## Phase 5: Polish & Production ✅
- [x] **Error handling** — Toast notification system (success/error/warning/info)
- [x] **Loading states** — Skeleton component added
- [x] **Responsive design** — Mobile sidebar with hamburger menu
- [x] **Rate limiting** — Per-route rate limiting on auth routes (10/min login, 5/min setup)
- [x] **Input validation** — Zod schemas for all input endpoints
- [x] **CI/CD** — GitHub Actions workflow (lint, typecheck, build, Docker)
- [x] **Docker optimization** — Multi-stage build, dependency caching, health check
- [x] **Security** — Rate limiting, input validation, SQL injection prevented (parameterized queries)
- [x] **Testing** — Unit tests for services, API integration tests
- [x] **README & docs** — Setup guide, architecture overview, contribution guide

---

## Beyond Phase 5
All 5 development phases are complete. See:
- **[ROADMAP.md](./ROADMAP.md)** — Future features, enhancements, and upcoming work
- **[ISSUES.md](./ISSUES.md)** — Known bugs, technical debt, and items to fix
