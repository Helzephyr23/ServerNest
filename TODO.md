# Biryani Development Phases

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

## Phase 5: Polish & Production
- [ ] **Error handling** — consistent error toasts, graceful failures
- [ ] **Loading states** — skeletons, spinners, optimistic updates
- [ ] **Responsive design** — mobile-friendly sidebar, layouts
- [ ] **Testing** — unit tests for services, API integration tests
- [ ] **README & docs** — setup guide, architecture overview, contribution guide
- [ ] **CI/CD** — GitHub Actions for lint, build, test
- [ ] **Docker optimization** — multi-stage build, layer caching
- [ ] **Security audit** — input validation, SQL injection prevention, rate limiting
- [ ] **Performance** — lazy loading, code splitting, bundle optimization
