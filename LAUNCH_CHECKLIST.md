# Launch Checklist

## Audit (July 2026)

A full codebase audit was conducted before launch. Below is a summary of findings, fixes, and remaining work.

---

## ✅ Fixed (ready for launch)

### Security
- **JWT secret verification** — `src/config/env.ts` now refuses to start with default secret (`change-me-to-a-random-string` or `change-me-in-production`)
- **JWT expiry reduced** — from 7 days to 24 hours
- **CORS restricted** — defaults to `false` in production; set via `CORS_ORIGIN` env var
- **Socket.IO CORS** — now follows same origin policy as REST API
- **Shell injection (files.ts)** — replaced `bash -c` with `echo '${b64}' | base64 -d` with `writeInContainer()` using `tee` via Docker exec stdin
- **Player name injection (players.ts)** — added `sanitizeName()` to all POST routes
- **Security headers** — HSTS + CSP added in production mode
- **Error handler** — centralized `setErrorHandler` sanitizes 500 errors in production (no stack traces leaked)

### Infrastructure
- **Docker Compose networking** — added `servernest` bridge network; `web` container now reaches `api` via hostname
- **Next.js proxy** — rewrite destination uses `API_HOST`/`API_PORT` env vars (defaults `localhost:3001`)
- **`.gitignore`** — added `web/.env`, `.env.*.local`, `.vscode/`, `.idea/`

 ### Code Quality
- **Zod validation** — `POST /api/nodes` now uses `schemas.createNode`; `PUT /files/content` now uses `schemas.fileContent`
- **Python dependency removed** — `routes/players.ts` no longer uses `python3 -c`; replaced with native `cat`/`tee` + Node.js JSON manipulation
- **TypeScript** — both backend and frontend pass `tsc --noEmit`
- **Tests** — 470/470 pass (387 api + 52 web + 31 agent)

### Infrastructure
- **CI/CD pipeline** — `.github/workflows/ci.yml` created with lint → typecheck → test → build on push/PR to `main`/`feat/*`

### UI
- **File upload** — upload button with file picker added to files manager toolbar

### Security Hardening
- **Brute-force lockout** — accounts locked for 15 minutes after 10 failed login attempts
- **TOTP encryption** — TOTP secrets encrypted at rest with AES-256-GCM (key derived from JWT_SECRET)
- **Helmet** — `@fastify/helmet` registered; replaces manual security headers

### Operational
- **Backup restore reuses containers** — `restoreBackup()` now stops/reuses existing container instead of always creating a new one

---

## 🔴 Critical (must fix before production)

### Security
- [x] **Encrypt TOTP secrets at rest** — encrypted with AES-256-GCM using key derived from JWT_SECRET
- [ ] ~~Fix placeholder email in SECURITY.md~~ — skipped (user choice)
- [x] **Add brute-force protection / account lockout** — 10 failed attempts locks account for 15 minutes
- [x] **Add `helmet` (fastify-helmet)** — registered in `src/index.ts`, replaced manual headers

### Infrastructure
- [x] **Add CI/CD pipeline (GitHub Actions)** — created `.github/workflows/ci.yml` (audit → lint → typecheck → test → build, plus Docker image build job)
- [x] **Pin dependency versions** — all `^` ranges replaced with exact versions across all 4 package.json files. Removed unused `adm-zip`, `@fastify/static` and duplicated root `@fastify/multipart`
- [x] **Run `pnpm audit`** — 0 known vulnerabilities (Sep 2026): findings resolved via scoped pnpm overrides (`sharp`, `postcss`, `js-yaml`, `uuid`, `qs`) + `fastify` bumped to 5.12.1 + `next` on 15.5.26; audit step added to CI (`--audit-level high`)

### Code Quality
- [x] **Replace Python JSON manipulation in `players.ts`** — now reads via `cat`, modifies in Node.js, writes via `tee`; no Python dependency
- [x] **Fix backup restore creating new container unnecessarily** — now reuses existing container if present, falls back to creating new one
- [ ] **Reduce `as any` usage** (~100+ occurrences in routes) — erodes type safety and suppresses real errors

### UI Gaps
- [x] **Add file upload UI** — upload button in files toolbar, uses hidden input + FormData via `api.upload()`

---

## 📋 Remaining (post-launch polish)

### High Priority
- [x] **Fix silent catch blocks** — `server.service.ts` and `backup.service.ts` now log warnings/errors
- [x] **Add Zod validation to remaining routes** — `rate-limits.ts` POST/PUT now use `schemas.createRateLimit`/`schemas.updateRateLimit`
- [x] **Deduplicate `execInContainer`/`writeInContainer`** — extracted to `src/utils/container.ts`, both `files.ts` and `players.ts` import from shared utility
- [ ] **Reduce `as any` usage** (~143 lint warnings) — erodes type safety and suppresses real errors
- [x] **Pin dependency versions** — all 4 package.json files now use exact versions (no `^`)

### Additional Fixes (July 2026 audit)
- [x] **Test helper schema drift** — added `failed_logins`, `totp_secret`/`totp_enabled`, `slug` columns to `__tests__/helpers.ts`
- [x] **moduleResolution** — backend `src/tsconfig.json` now uses `"module": "Node16"` / `"moduleResolution": "Node16"`
- [x] **Docker NEXT_PUBLIC_API_URL** — removed; REST is now same-origin via the Next.js `/api` proxy (works from any host). Optional `NEXT_PUBLIC_SOCKET_URL` override remains for exotic topologies
- [x] **Hardcoded Minecraft versions** — `new/page.tsx` and `import/page.tsx` now fetch from `/api/mc-versions` with fallback
- [x] **Shared constants** — extracted `SOFTWARE_OPTIONS`, `RAM_OPTIONS`, `FALLBACK_VERSIONS` to `web/lib/constants.ts`
- [x] **Server context error state** — `ServerContextType` now includes `error: string | null`
- [x] **Install script** — uses `SERVERNEST_REPO` env var, checks for `docker compose` v2
- [x] **Docker socket warning** — inline security comment in `docker-compose.yml`
- [x] **web/public** — created with `robots.txt`

### Low Priority
- [ ] Replace `console.log` in agent with proper logger
- [x] Add `ISSUES.md` (referenced in ROADMAP) — already existed, updated with fixes
- [ ] Add Code of Conduct
- [ ] Add `author`, `repository`, `bugs`, `homepage` fields to `package.json`
- [x] **Remove unused dependencies** — `adm-zip`, `@fastify/static` already removed
- [x] **Deduplicate root dependency** — `@fastify/multipart` no longer duplicated
- [x] **Update ROADMAP.md checkboxes** — several items already implemented
- [x] **Verify `next.config.ts` has `output: "standalone"`** — confirmed present

---

## Files Modified

| File | Change |
|---|---|---|
| `.gitignore` | Added patterns for `web/.env`, `.env.*.local`, `.vscode/`, `.idea/` |
| `.github/workflows/ci.yml` | Created CI pipeline (lint → typecheck → test → build) |
| `docker-compose.yml` | Added `servernest` network; `API_HOST=api` env for web container |
| `src/config/env.ts` | `JWT_EXPIRES_IN` 24h; `checkJwtSecret()` startup guard |
| `src/config/database.ts` | Added `failed_logins` table for brute-force lockout tracking |
| `src/index.ts` | CORS, CSP, HSTS, error handler, Socket.IO CORS; added `@fastify/helmet` |
| `src/routes/auth.ts` | Brute-force lockout check before login; `recordFailedLogin`/`clearFailedLogins` |
| `src/routes/files.ts` | `writeInContainer()` function; no shell interpolation |
| `src/routes/nodes.ts` | Zod validation via `schemas.createNode` |
| `src/routes/players.ts` | `sanitizeName()`; replaced all `python3 -c` JSON manipulation with native `cat`/`tee` I/O |
| `src/services/auth.service.ts` | TOTP secrets encrypted at rest (AES-256-GCM); lockout management functions |
| `src/services/backup.service.ts` | Restore reuses existing container instead of always creating a new one |
| `web/lib/api.ts` | Added `api.upload()` method for multipart/form-data uploads |
| `web/app/.../files/page.tsx` | Added "Upload" button, file input, and upload handler |
| `web/next.config.ts` | `API_HOST`/`API_PORT` env vars for rewrite destination |
