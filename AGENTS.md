# AGENTS.md - ServerNest Project Context

Guidance for AI coding agents (and humans) working in this repository.

## Project Overview

**ServerNest** is a free, open-source, self-hosted Minecraft server management panel. It manages
Minecraft servers as Docker containers, with a built-in Modrinth mod marketplace, multi-node
clustering, and cloud backup support.

## Tech Stack

- **Backend**: Node.js >= 20 + TypeScript + Fastify 5 (port 3001), package `@servernest/api` in `src/`
- **Frontend**: Next.js 15 App Router + React 19 + Tailwind + shadcn/ui (port 3000), package `@servernest/web` in `web/`
- **Node agent**: Express, package `@servernest/agent` in `agent/` (port 50051)
- **Database**: SQLite via `better-sqlite3`
- **Containers**: Docker via `dockerode` (`itzg/minecraft-server` image)
- **Realtime**: Socket.IO (console streaming + status events)
- **Validation**: Zod (schemas in `src/middleware/validate.ts`)
- **Auth**: JWT (`@fastify/jwt`) + Argon2id + TOTP 2FA + DB sessions
- **Mod integration**: Modrinth API
- **Monorepo**: pnpm workspaces — root `package.json` + `pnpm-workspace.yaml` (4 projects: root, `src`, `web`, `agent`)

## Project Structure

```
servernest/
├── src/                            # @servernest/api — Fastify backend
│   ├── index.ts                    # Entry point: plugin registration, Socket.IO, schedulers
│   ├── config/
│   │   ├── env.ts                  # Env parsing + checkJwtSecret() production guard
│   │   ├── database.ts             # SQLite connection + migrate() + table DDL
│   │   └── docker.ts               # Dockerode client + dockerStreamDemux()
│   ├── middleware/
│   │   ├── auth.ts                 # authMiddleware / adminMiddleware / operatorOrAboveMiddleware
│   │   ├── rate-limit.ts           # DB-backed per-route rate limiting
│   │   └── validate.ts             # Zod schemas + validation helpers
│   ├── routes/                     # 17 route modules (thin: validate + delegate)
│   ├── services/                   # 13 service modules (all business logic lives here)
│   ├── utils/
│   │   ├── container.ts            # execInContainer() / writeInContainer() — shared docker exec
│   │   ├── logger.ts               # Shared logger
│   │   └── mc-version.ts           # Minecraft version helpers
│   ├── types/fastify.d.ts          # request.user augmentation
│   └── __tests__/                  # Vitest: services/, routes/, middleware/
├── web/                            # @servernest/web — Next.js frontend
│   ├── app/
│   │   ├── page.tsx                # Landing / redirect
│   │   ├── login/page.tsx          # Login (password + TOTP challenge)
│   │   ├── setup/page.tsx          # First-run admin setup
│   │   ├── error.tsx / not-found.tsx
│   │   └── dashboard/              # Auth-guarded app shell
│   │       ├── page.tsx            # Overview
│   │       ├── servers/            # list, new, import, [id]/*
│   │       ├── users/ sessions/ audit/ rate-limits/ notifications/ tasks/
│   │       ├── templates/ marketplace/ nodes/ settings/
│   ├── components/                 # sidebar, toast, theme, error-boundary, route-progress, confirm-dialog
│   ├── components/ui/              # shadcn/ui primitives
│   └── lib/
│       ├── api.ts                  # API client wrapper (auth, errors, upload)
│       ├── auth.tsx                # useAuth() context provider
│       ├── socket.ts               # Socket.IO client
│       ├── server-context.tsx      # Shared server state
│       ├── constants.ts            # SOFTWARE_OPTIONS, RAM_OPTIONS, FALLBACK_VERSIONS
│       └── utils.ts                # formatBytes, formatDate
├── agent/                          # @servernest/agent — remote node agent
│   ├── src/index.ts                # Entry point
│   └── src/app.ts                  # Express app: x-api-key auth, container + stats proxies
├── Dockerfile                      # Multi-stage: api-runtime / web-runtime targets
├── docker-compose.yml              # api + web services on a bridge network
├── .github/workflows/ci.yml        # audit → lint → typecheck → test → coverage → build
├── eslint.config.mjs, tsconfig.base.json, pnpm-workspace.yaml
├── .env.example                    # Copied to .env; all values are safe placeholders
├── README.md, CONTRIBUTING.md, CODE_OF_CONDUCT.md, SECURITY.md, ROADMAP.md, ISSUES.md
└── package.json                    # Root workspace scripts (pnpm, not npm)
```

## API Surface

All endpoints are prefixed `/api` and require auth unless noted. The full annotated table lives in
`README.md`; this is the shape of it.

| Module | Prefix | Notes |
|--------|--------|-------|
| `auth.ts` | `/api/auth` | `setup`, `login`, `logout`, `reset`, `me`, `status`, `2fa/{setup,verify,challenge,disable,status}` |
| `servers.ts` | `/api/servers` | CRUD, `start`/`stop`/`restart`, `clone`, `command`, `properties`, `config`, `logs`, `metrics[+/history]`, `import`, `update-version` |
| `backups.ts` | `/api/servers/:id/backups` + `/api/backups/:backupId` | create (202, async), `restore`, `download`, `progress`; delete supports `?scope=all\|local\|cloud` |
| `files.ts` | `/api/servers/:id/files` | `ls`, `content` (GET/PUT), `mkdir`, `upload`, `download`, delete by `?path=` |
| `players.ts` | `/api/servers/:id/players/{whitelist,ops,bans}` | CRUD; names pass through `sanitizeName()` |
| `mods.ts` | `/api/mods` + `/api/servers/:id/mods` | search, versions, `install`, `install-batch`, `check-updates`, `update/:filename` |
| `users.ts` | `/api/users` | admin-only: list, create, `role`, `password`, delete |
| `sessions.ts` | `/api/sessions` | list, revoke, `revoke-all` |
| `nodes.ts` | `/api/nodes` | list/CRUD, `heartbeat`, `metrics`, `find-for-server`, `servers` |
| `schedule.ts` | `/api/tasks` + `/api/servers/:id/tasks` | cron tasks: backup/restart/stop/start/command; `run` to trigger now |
| `templates.ts` | `/api/templates` | preconfigured server profiles |
| `cloud-storage.ts` | `/api/servers/:id/cloud-storage` | S3 / Google Drive / Dropbox config CRUD + `test` |
| `google-drive.ts` | `/api/google-drive` | `auth-url`, `callback`, `status`, `disconnect`, `test` |
| `notifications.ts` | `/api/notifications` | Discord webhook config + `test` |
| `audit.ts` | `/api/audit` | paginated admin action log |
| `rate-limits.ts` | `/api/rate-limits` | DB-configurable per-route limits |
| `overview.ts` | `/api/overview`, `/api/mc-versions` | dashboard rollup; MC version list |
| — | `/api/health` | unauthenticated liveness + Docker ping |

**Socket.IO** events: `console:subscribe`, `console:attach`, `console:detach`, `console:unsubscribe`,
`console:command`, plus server-side emits `console:output`, `console:attached`, `console:detached`,
`console:error`, `server:status`. Clients join a `server-<id>` room. Console access requires
`admin` or `operator`.

## Roles

`admin` > `operator` > `user`. Middleware in `src/middleware/auth.ts`:

- `authMiddleware` — validates JWT and the backing session; populates `request.user`
- `operatorOrAboveMiddleware` — console and similar operator actions
- `adminMiddleware` — user management, audit, rate limits, settings

## Key Conventions

- **Tokens** travel in the `servernest_token` cookie *or* an `Authorization: Bearer <token>` header.
  `authMiddleware` accepts either. Socket.IO accepts `handshake.auth.token` or the same cookie.
- **Sessions are revocable.** Each token carries a `jti`; `authMiddleware` rejects tokens whose
  session row is gone. Keep this in mind when adding auth.
- **Every mutating route needs auth** — pick the narrowest middleware that fits.
- **Never interpolate into shell strings** for container commands. Use `execInContainer` /
  `writeInContainer` from `src/utils/container.ts` and pipe content over stdin.
- **Routes are thin.** Validate with Zod, then delegate to a service. Business logic belongs in `src/services/`.
- **Frontend is same-origin.** Next.js rewrites `/api/*` and `/socket.io/*` to the API
  (`API_HOST`/`API_PORT`, default `localhost:3001`). There is no `NEXT_PUBLIC_API_URL`. Use the
  `api` wrapper from `web/lib/api.ts` and `useAuth()` from `web/lib/auth.tsx`.
- **Backup upload progress is DB-backed** (`bytes_uploaded`/`total_bytes` on `backup_uploads`) so it
  survives page refresh. Google Drive uploads use the resumable protocol via Node's global `fetch`
  (not gaxios).
- **Security overrides are split across two files and both are load-bearing.** `package.json` has a
  `pnpm.overrides` block (postcss, sharp, uuid, js-yaml, qs) and `pnpm-workspace.yaml` has a
  `overrides:` block (brace-expansion, fast-uri, find-my-way, nanoid). pnpm 9.15 reads the
  `package.json` block and prints a deprecation warning, but the bare ranges there are what force
  `next`'s pinned `postcss@8.4.31` up to 8.5.x — the `>=8.5.23` range in `pnpm-workspace.yaml`
  alone is silently skipped because the parent's pinned range is unsatisfiable. **Removing either
  block reintroduces advisories.** Do not "clean up" the warning without re-running `pnpm audit`.
- **Dependency versions are pinned exactly** (no `^`) outside of the root `cron-parser`.

## Environment Variables

See `.env.example`. The ones that matter:

| Variable | Default | Notes |
|----------|---------|-------|
| `JWT_SECRET` | *(random ephemeral)* | **Required in production** — `checkJwtSecret()` calls `process.exit(1)` on an unset or placeholder value |
| `JWT_EXPIRES_IN` | `24h` | |
| `API_PORT` / `PANEL_PORT` | `3001` / `3000` | |
| `DATABASE_PATH` | `./data/servernest.db` | |
| `DOCKER_IMAGE` | `itzg/minecraft-server` | |
| `SERVER_PORT_RANGE_START`/`_END` | `25565`/`25665` | Dynamic host port allocation |
| `NODE_NAME`, `NODE_API_KEY`, `GRPC_PORT` | `master`, `""`, `50051` | Agent identity and shared secret |
| `CORS_ORIGIN` | *(all, dev)* | **Set this in production** |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | `""` | Google Drive OAuth |
| `ALLOWED_DEV_ORIGINS` | `**.ts.net` | Dev-only `/_next/*` origin allowlist |

TOTP secrets are encrypted at rest with AES-256-GCM, keyed from `JWT_SECRET`.

## Development

This is a pnpm workspace — use `pnpm`, not `npm` or `yarn`.

```bash
pnpm install
cp .env.example .env
pnpm dev          # API :3001 + web :3000
pnpm test         # 470 tests across all 3 packages
pnpm lint
pnpm typecheck
pnpm build
```

Run the full CI gate before opening a PR:

```bash
pnpm audit --audit-level high && pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

## Testing

- **Vitest** everywhere. Tests use in-memory SQLite with Docker and external services mocked —
  no live Docker or network required.
- `src/__tests__/schema.ts` is the single source of truth for the test DB schema. When you add a
  column in `src/config/database.ts`, mirror it there or tests will drift and fail confusingly.
- `src/__tests__/helpers.ts` holds `createTestDb`, `seedServer`, `mockDocker`.
- Playwright specs live in `web/e2e/`.

## Server Lifecycle

1. User creates a server in the dashboard → `server.service.ts` creates a Docker container.
2. The container runs `itzg/minecraft-server` configured via environment variables.
3. Persistent data is mounted at `/data` inside the container.
4. A host port is allocated dynamically from `SERVER_PORT_RANGE_START`–`SERVER_PORT_RANGE_END`.
5. File, player, property, and console operations all run `docker exec` **inside** the container.
6. Status is tracked in the `servers` table (`stopped` / `starting` / `running` / `error`) and
   reconciled against Docker every 15s by the loop in `src/index.ts`.

## Background Jobs

All started from `src/index.ts`:

| Interval | Job |
|----------|-----|
| 15s | Reconcile server status against Docker, clear `container_id` on exit |
| 60s | `collectAllMetrics()` — per-server CPU/RAM/player metrics with history |
| 60s | `markStaleNodesOffline()` |
| 60s | `checkAndRunAutoBackups()` |
| 1h | `rotateAllBackups()` |
| cron | `startAllTasks()` — scheduled backup/restart/stop/start/command tasks |

All intervals are cleared in `gracefulShutdown()` on SIGTERM/SIGINT — if you add one, clear it there too.
