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
- **Docker Compose networking** — added `biryani` bridge network; `web` container now reaches `api` via hostname
- **Next.js proxy** — rewrite destination uses `API_HOST`/`API_PORT` env vars (defaults `localhost:3001`)
- **`.gitignore`** — added `web/.env`, `.env.*.local`, `.vscode/`, `.idea/`

 ### Code Quality
- **Zod validation** — `POST /api/nodes` now uses `schemas.createNode`; `PUT /files/content` now uses `schemas.fileContent`
- **Python dependency removed** — `routes/players.ts` no longer uses `python3 -c`; replaced with native `cat`/`tee` + Node.js JSON manipulation
- **TypeScript** — both backend and frontend pass `tsc --noEmit`
- **Tests** — 114/115 pass (1 pre-existing failure unrelated to audit)

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
- [x] **Add CI/CD pipeline (GitHub Actions)** — created `.github/workflows/ci.yml` (lint → typecheck → test → build)
- [ ] **Pin dependency versions** and run `pnpm audit` to eliminate unpinned range risks

### Code Quality
- [x] **Replace Python JSON manipulation in `players.ts`** — now reads via `cat`, modifies in Node.js, writes via `tee`; no Python dependency
- [x] **Fix backup restore creating new container unnecessarily** — now reuses existing container if present, falls back to creating new one
- [ ] **Reduce `as any` usage** (~100+ occurrences in routes) — erodes type safety and suppresses real errors

### UI Gaps
- [x] **Add file upload UI** — upload button in files toolbar, uses hidden input + FormData via `api.upload()`

---

## 📋 Remaining (post-launch polish)

### High Priority
- [ ] **Fix silent catch blocks** — `server.service.ts:168-169` and `backup.service.ts:95-97` silently swallow Docker operation errors
- [ ] **Add Zod validation to remaining routes** — import, update, config endpoints lack schema validation
- [ ] **Deduplicate `execInContainer`/`writeInContainer`** — now only duplicated in `routes/files.ts` and `routes/players.ts` (no longer uses Python); extract to shared utility
- [ ] **Reduce `as any` usage** (~100+ occurrences in routes) — erodes type safety and suppresses real errors
- [ ] **Pin dependency versions** and run `pnpm audit` to eliminate unpinned range risks

### Low Priority
- [ ] Replace `console.log` in agent with proper logger
- [ ] Add `ISSUES.md` (referenced in ROADMAP)
- [ ] Add Code of Conduct
- [ ] Add `author`, `repository`, `bugs`, `homepage` fields to `package.json`
- [ ] **Remove unused dependencies** (`adm-zip`, `@fastify/static` in `src/package.json`)
- [ ] **Deduplicate root dependency** — `@fastify/multipart` in both root and `src/package.json`
- [ ] **Update ROADMAP.md checkboxes** — several `[ ]` items already implemented (2FA, cloud backups, rate limit UI, session mgmt, batch mod install, cloning, version updater)
- [ ] **Verify `next.config.ts` has `output: "standalone"`** — Dockerfile expects `.next/standalone/` for web runtime stage

---

## Files Modified

| File | Change |
|---|---|---|
| `.gitignore` | Added patterns for `web/.env`, `.env.*.local`, `.vscode/`, `.idea/` |
| `.github/workflows/ci.yml` | Created CI pipeline (lint → typecheck → test → build) |
| `docker-compose.yml` | Added `biryani` network; `API_HOST=api` env for web container |
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
