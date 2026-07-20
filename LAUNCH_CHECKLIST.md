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
- **TypeScript** — both backend and frontend pass `tsc --noEmit`
- **Tests** — 114/115 pass (1 pre-existing failure unrelated to audit)

---

## 🔴 Critical (must fix before production)

### Security
- [ ] **Encrypt TOTP secrets at rest** — stored in plaintext in SQLite; use encryption-at-rest or a dedicated secrets store
- [ ] **Fix placeholder email in SECURITY.md** — `[your-email@example.com]` routes vulnerability reports nowhere
- [ ] **Add brute-force protection / account lockout** — currently only rate limited (10 req/min); no account lockout on repeated failed logins
- [ ] **Add `helmet` (fastify-helmet)** for more comprehensive security headers (currently set manually)

### Infrastructure
- [ ] **Add CI/CD pipeline (GitHub Actions)** — `.github/workflows/` is empty; no automated lint → typecheck → test → build on push/PR
- [ ] **Pin dependency versions** and run `pnpm audit` to eliminate unpinned range risks

### Code Quality
- [ ] **Replace Python JSON manipulation in `players.ts`** — `routes/players.ts` uses `python3 -c` via Docker exec to edit JSON files; fragile, requires Python in containers. Replace with native `cat`/`tee` + built-in JSON manipulation
- [ ] **Fix backup restore creating new container unnecessarily** — `backup.service.ts` always creates a new container on restore instead of reusing an existing one; can cause orphan containers and port conflicts
- [ ] **Reduce `as any` usage** (~100+ occurrences in routes) — erodes type safety and suppresses real errors

### UI Gaps
- [ ] **Add file upload UI** — backend endpoint `POST /api/servers/:id/files/upload` exists, but the frontend files page has no upload button

---

## 📋 Remaining (post-launch polish)

### High Priority
- [ ] **Fix silent catch blocks** — `server.service.ts:168-169` and `backup.service.ts:95-97` silently swallow Docker operation errors
- [ ] **Add Zod validation to remaining routes** — import, update, config endpoints lack schema validation
- [ ] **Deduplicate `execInContainer`/`writeInContainer`** — duplicated in both `routes/files.ts` and `routes/players.ts`; extract to shared utility

### Low Priority
- [ ] Replace `console.log` in agent with proper logger
- [ ] Add `ISSUES.md` (referenced in ROADMAP)
- [ ] Add Code of Conduct
- [ ] Add `author`, `repository`, `bugs`, `homepage` fields to `package.json`
- [ ] **Remove unused dependencies** (`adm-zip`, `@fastify/static` in `src/package.json`)
- [ ] **Deduplicate root dependency** — `@fastify/multipart` in both root and `src/package.json`
- [ ] **Update ROADMAP.md checkboxes** — several `[ ]` items already implemented (2FA, cloud backups, rate limit UI, session mgmt, batch mod install, cloning, version updater)
- [ ] **Add `.env` to `.gitignore`** — `.env` file appears to be committed; should be gitignored
- [ ] **Verify `next.config.ts` has `output: "standalone"`** — Dockerfile expects `.next/standalone/` for web runtime stage

---

## Files Modified

| File | Change |
|---|---|
| `.gitignore` | Added patterns for `web/.env`, `.env.*.local`, `.vscode/`, `.idea/` |
| `docker-compose.yml` | Added `biryani` network; `API_HOST=api` env for web container |
| `src/config/env.ts` | `JWT_EXPIRES_IN` 24h; `checkJwtSecret()` startup guard |
| `src/index.ts` | CORS, CSP, HSTS, error handler, Socket.IO CORS |
| `src/routes/files.ts` | `writeInContainer()` function; no shell interpolation |
| `src/routes/nodes.ts` | Zod validation via `schemas.createNode` |
| `src/routes/players.ts` | `sanitizeName()` on all POST routes |
| `web/next.config.ts` | `API_HOST`/`API_PORT` env vars for rewrite destination |
