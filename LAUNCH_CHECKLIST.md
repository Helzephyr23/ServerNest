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

## 📋 Remaining (post-launch polish)

### Medium Priority
- [ ] Add CI/CD pipeline (GitHub Actions) — `.github/workflows/` is empty
- [ ] Pin dependency versions and run `pnpm audit`
- [ ] Reduce `as any` usage (~100+ occurrences in routes)
- [ ] Replace Python JSON manipulation in `players.ts` with proper `rcon-cli` commands
- [ ] Add `helmet` (fastify-helmet) for more comprehensive security headers
- [ ] Add brute-force protection / account lockout
- [ ] Encrypt TOTP secrets at rest

### Low Priority
- [ ] Add Zod validation to remaining routes (import, update, config endpoints)
- [ ] Replace `console.log` in agent with proper logger
- [ ] Add `ISSUES.md` (referenced in ROADMAP)
- [ ] Add Code of Conduct
- [ ] Add `author`, `repository`, `bugs`, `homepage` fields to `package.json`

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
