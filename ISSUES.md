# Biryani - Pre-Release Audit Report

**Date:** 2025-07-21
**Status:** Pre-launch audit for open-source release

---

## Table of Contents

1. [Test Suite Results](#1-test-suite-results)
2. [Critical Bugs (Must Fix)](#2-critical-bugs-must-fix)
3. [High-Severity Issues](#3-high-severity-issues)
4. [Security Concerns](#4-security-concerns)
5. [Medium-Severity Issues](#5-medium-severity-issues)
6. [Low-Severity Issues](#6-low-severity-issues)
7. [Test Coverage Gaps](#7-test-coverage-gaps)
8. [Frontend Issues](#8-frontend-issues)

---

## 1. Test Suite Results

### `pnpm test` — 0 FAILED, 115 PASSED (115 total)

> ✅ **FIXED** — All tests pass. Integration test schema updated, login route fixes resolved the 500 errors.

### `pnpm typecheck` — 0 TypeScript Errors

> ✅ **FIXED** — Agent `@types/express` downgraded to 4.17.x to match Express 4.x runtime. All 3 projects (src, web, agent) typecheck clean.

### `pnpm lint` — 0 ERRORS (143 warnings, all `no-explicit-any`)

> ✅ **FIXED** — ESLint flat config created with `@eslint/js` + `typescript-eslint`. All unused imports/vars fixed. 0 errors across src/ and web/.

---

## 2. Critical Bugs (Must Fix)

### BUG-001: `install.sh` writes JWT secret to wrong variable ✅ FIXED

**File:** `scripts/install.sh:27`
**Severity:** CRITICAL

> **Fix applied:** sed pattern changed from `change-me-to-a-random-string` to `change-me-in-production` to match `.env.example`.

---

### BUG-002: Socket.IO singleton never disconnected on logout ✅ FIXED

**File:** `web/lib/auth.tsx:64-68`
**Severity:** CRITICAL

> **Fix applied:** `disconnectSocket()` called before logout redirect in `web/lib/auth.tsx`.

---

### BUG-003: Login page bypasses auth context ✅ FIXED

**File:** `web/app/login/page.tsx:24-29`
**Severity:** CRITICAL

> **Fix applied:** Login page refactored to use `useAuth().login()` and `useAuth().verifyTotp()`. `AuthProvider` moved to root layout.

---

### BUG-004: `uploadFile()` has no timeout or error handling ✅ FIXED

**File:** `web/lib/api.ts:52-78`
**Severity:** HIGH

> **Fix applied:** `AbortController` + 120s timeout + network error handling added to `uploadFile()`.

---

### BUG-005: Import page bypasses API wrapper entirely ✅ FIXED

**File:** `web/app/dashboard/servers/import/page.tsx`
**Severity:** HIGH

> **Fix applied:** Fetch now uses `AbortController` + 120s timeout + network error handling.

---

### BUG-006: Unhandled promise rejections in multiple pages ✅ FIXED

**File:** `web/app/dashboard/servers/page.tsx:24-33`
**Severity:** HIGH

> **Fix applied:** try/catch with toast error feedback added to all unhandled async handlers in servers, tasks, and layout pages.

---

## 3. High-Severity Issues

### ISSUE-001: Dockerfile — Both runtime containers run as root ✅ FIXED

**File:** `Dockerfile:28, 43`

> **Fix applied:** Non-root `biryani` user created and `USER biryani` added to both runtime stages.

---

### ISSUE-002: Dockerfile — `COPY src/` before `pnpm install` breaks layer caching ✅ FIXED

**File:** `Dockerfile:6-7`

> **Fix applied:** Package files copied before source in both build stages.

---

### ISSUE-003: Dockerfile — `pnpm-workspace.yaml` missing from web-runtime ✅ FIXED

**File:** `Dockerfile:46`

> **Fix applied:** `pnpm-workspace.yaml` added to both runtime stages.

---

### ISSUE-004: `.dockerignore` includes test files and unused workspaces in production ✅ FIXED

**File:** `.dockerignore`

> **Fix applied:** Added `agent/`, `__tests__/`, `scripts/`, `.github/`, `*.test.ts`, `vitest.config.ts`, `ISSUES.md`.

---

### ISSUE-005: `docker-compose.yml` — No resource limits ✅ FIXED

**File:** `docker-compose.yml`

> **Fix applied:** Added `deploy.resources.limits` (2G/2CPUs/512 PIDs for API, 1G/1CPU for web).

---

### ISSUE-006: `docker-compose.yml` — No health-aware dependency ordering ✅ FIXED

**File:** `docker-compose.yml:45-46`

> **Fix applied:** Changed to `depends_on: api: condition: service_healthy`. Added healthcheck block to API service.

---

### ISSUE-007: `tsconfig` — `moduleResolution: "bundler"` hides ESM errors

**File:** `tsconfig.base.json:5`

The base config sets `moduleResolution: "bundler"`, which relaxes strictness that `node16`/`nodenext` resolution enforces. Since `src` uses `tsc` (not a bundler) as its build tool, this can hide invalid import paths that fail at runtime.

**Fix:** Use `moduleResolution: "node16"` or `"nodenext"` for the `src` workspace.

---

### ISSUE-008: No ESLint config file anywhere in the project ✅ FIXED

**Files:** None found (confirmed via glob search)

> **Fix applied:** Created `eslint.config.mjs` with flat config using `@eslint/js` + `typescript-eslint`. Fixed web lint script path. Fixed all unused imports/vars across codebase.

---

### ISSUE-009: `src/package.json` — `db:migrate` references non-existent file ✅ FIXED

**File:** `src/package.json:11`

> **Fix applied:** Removed broken `db:migrate` script from both `src/package.json` and root `package.json`. Migrations are handled by `database.ts` inline.

---

### ISSUE-010: No graceful shutdown handler ✅ FIXED

**File:** `src/index.ts`

> **Fix applied:** Added `SIGTERM`/`SIGINT` handlers that clear intervals, destroy active attachments, close Socket.IO, and call `app.close()`.

---

### ISSUE-011: `.env.example` — `NEXT_PUBLIC_API_URL` defaults to localhost

**File:** `.env.example:35`

```
NEXT_PUBLIC_API_URL=http://127.0.0.1:3001
```

Inside Docker, the web container cannot reach `127.0.0.1:3001` — it needs `http://api:3001`. Since `NEXT_PUBLIC_*` values are baked into the Next.js build at build time, the standalone web container will try to reach the API at localhost, which is wrong inside Docker networking.

The `docker-compose.yml` build arg `NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL:-http://127.0.0.1:3001}` has the same default.

**Fix:** Default to `http://api:3001` in Docker context, or document that users must set this.

---

### ISSUE-012: Console page creates independent socket connection ✅ FIXED

**File:** `web/app/dashboard/servers/[id]/console/page.tsx:92-98`

> **Fix applied:** Replaced hardcoded `io()` with `getSocket()` from `@/lib/socket`. Added proper event listener cleanup.

---

## 4. Security Concerns

### SEC-001: JWT stored in localStorage (XSS-vulnerable)

**File:** `web/lib/api.ts:6`

`localStorage.getItem("biryani_token")` means the JWT is accessible to any JavaScript on the page. If XSS is achieved, the token is trivially exfiltrated. httpOnly cookies would be more secure.

---

### SEC-002: No server-side auth on page routes

All authentication is client-side only. The `/dashboard/*` routes have no server-side middleware or layout check. The Next.js pages are `"use client"` only, meaning SSR does not provide protection either.

---

### SEC-003: CSP only applied in production

**File:** `web/next.config.ts:30`

```typescript
if (!isProduction) return [];
```

No security headers at all in development. Developers cannot test CSP compliance during development, and CSP issues are only caught in production.

---

### SEC-004: `'unsafe-inline'` in CSP `style-src`

**File:** `web/next.config.ts:10`

```typescript
"style-src 'self' 'unsafe-inline'";
```

Inline styles are allowed, weakening XSS protection. Required by Tailwind CSS and shadcn/ui but should be noted.

---

### SEC-005: Docker socket mount with no mitigation

**File:** `docker-compose.yml:27`

```yaml
- /var/run/docker.sock:/var/run/docker.sock
```

Mounts the Docker daemon socket into the API container, granting effective root access to the host. An attacker who compromises the API container can create privileged containers and fully compromise the host. No warning, documentation, or mitigation (e.g., rootless Docker, socket proxy).

---

### SEC-006: No `Strict-Transport-Security` header ✅ FIXED

**File:** `web/next.config.ts`

> **Fix applied:** Added `Strict-Transport-Security: max-age=31536000; includeSubDomains` header.

---

### SEC-007: No rate limiting on login form (client-side)

**File:** `web/app/login/page.tsx`

No client-side debounce or rate limit on form submissions. A user or script can spam the login button. Server-side rate limiting exists but the client provides no feedback about lockouts.

---

### SEC-008: Setup page accessible without client guard ✅ FIXED

**File:** `web/app/setup/page.tsx`

> **Fix applied:** Added `useEffect` guard that checks `/api/auth/status` and redirects to `/dashboard` if setup is complete.

---

### SEC-009: No `Permissions-Policy` header ✅ FIXED

**File:** `web/next.config.ts`

> **Fix applied:** Added `Permissions-Policy: camera=(), microphone=(), geolocation=()` header.

---

### SEC-010: Install script has hardcoded GitHub URL

**File:** `scripts/install.sh:19`

```bash
git clone https://github.com/Helzephyr23/biryani.git "$INSTALL_DIR"
```

If the repository is renamed, forked, or moved, the install script breaks. Should use a variable or detect the current repo.

---

## 5. Medium-Severity Issues

### MED-001: `auth.service.test.ts` — Missing `failed_logins` table in test helper

**File:** `src/__tests__/helpers.ts`

The `createTestDb()` helper does not include the `failed_logins` table, making `isAccountLocked()`, `recordFailedLogin()`, and `clearFailedLogins()` untestable.

---

### MED-002: `auth.service.test.ts` — Missing `totp_secret` and `totp_enabled` columns

**File:** `src/__tests__/helpers.ts:8-14`

The test helper `users` table does not include `totp_secret` or `totp_enabled` columns that exist in production `database.ts`. All TOTP functions are untestable.

---

### MED-003: Three separate test DB schemas with drift

**Files:** `src/__tests__/helpers.ts`, `src/__tests__/routes/api.integration.test.ts`, `src/__tests__/services/node.service.test.ts`

Three locations define the test database schema manually, kept in sync by hand. They have already drifted — the integration test is missing `failed_logins`, `cloud_storage_configs`, `backup_uploads`, `server_metrics`, and `slug` on `installed_mods`.

**Fix:** Extract a single shared schema builder and use it everywhere.

---

### MED-004: Integration test only registers 2 of 15 route modules

**File:** `src/__tests__/routes/api.integration.test.ts:60-61`

```typescript
await app.register(authRoutes);
await app.register(serverRoutes);
```

Only `auth` and `servers` routes are registered. The other 13 route modules (backups, files, mods, nodes, players, schedule, templates, notifications, users, overview, cloud-storage, rate-limits, sessions) have zero integration test coverage.

---

### MED-005: Socket default URL differs between `socket.ts` and `api.ts` ✅ FIXED

**Files:** `web/lib/socket.ts:10`, `web/lib/api.ts:1`

> **Fix applied:** `socket.ts` default changed from `"http://127.0.0.1:3001"` to `""` to match `api.ts`.

---

### MED-006: Server context has no error state

**File:** `web/lib/server-context.tsx`

The `ServerContextType` has `server`, `loading`, and `refresh` but no `error`. Consumers cannot distinguish between "no server found (404)" and "network error". Errors are caught silently with `catch { setServer(null); }`.

---

### MED-007: Toast duration hardcoded at 5s ✅ FIXED

**File:** `web/components/toast.tsx:42-43`

> **Fix applied:** Duration now configurable — 5s default, 8s for error toasts.

---

### MED-008: Hardcoded Minecraft versions in server creation

**Files:** `web/app/dashboard/servers/new/page.tsx:19`, `web/app/dashboard/servers/import/page.tsx:20`

Minecraft versions are hardcoded as a constant array. The settings page (`settings/page.tsx`) fetches versions dynamically from `/api/mc-versions`, but the server creation page does not use this endpoint. New versions require frontend redeployment.

---

### MED-009: Duplicate `formatBytes` function with different behavior ✅ FIXED

**File:** `web/app/dashboard/servers/[id]/mods/page.tsx:13-18`

> **Fix applied:** Removed local `formatBytes`, imported from `@/lib/utils`.

---

### MED-010: `window.location.reload()` after version update ✅ FIXED

**File:** `web/app/dashboard/servers/[id]/settings/page.tsx:113`

> **Fix applied:** Replaced `window.location.reload()` with `refresh()` from server context.

---

### MED-011: Duplicate `VERSIONS` and `RAM_OPTIONS` constants

**Files:** `web/app/dashboard/servers/new/page.tsx:19-20`, `web/app/dashboard/servers/import/page.tsx:20-21`

Identical hardcoded constants are duplicated across two files. Should be extracted to a shared constants file.

---

### MED-012: `install.sh` doesn't check for `docker compose` v2

**File:** `scripts/install.sh:34`

The script uses `docker compose` (v2 syntax) but only checks for `docker` (line 8). Systems with only `docker-compose` (v1, Python-based) installed will fail.

---

### MED-013: Dockerfile hardcodes pnpm version in 4 places ✅ FIXED

**File:** `Dockerfile:3, 12, 30, 44`

> **Fix applied:** Added `ARG PNPM_VERSION=9.15.0` at top, replaced all 4 hardcoded instances with `${PNPM_VERSION}`.

---

## 6. Low-Severity Issues

### LOW-001: `declaration` and `declarationMap` generate unnecessary artifacts ✅ FIXED

**File:** `tsconfig.base.json:11-12`

> **Fix applied:** Set `declaration: false` and `declarationMap: false`.

---

### LOW-002: `src/package.json` heavy dependencies loaded eagerly

**File:** `src/package.json`

`googleapis` (173MB+ dependency tree), `dropbox`, `otplib`, `qrcode`, `@aws-sdk/client-s3`, and `@aws-sdk/lib-storage` are all loaded eagerly at startup even if the features are not configured. Dynamic imports would reduce startup time and Docker image size.

---

### LOW-003: No test coverage reporting in CI

**File:** `.github/workflows/ci.yml`

Tests run but there is no coverage threshold enforcement or coverage artifact upload. No way to track coverage over time.

---

### LOW-004: No Docker build verification in CI

**File:** `.github/workflows/ci.yml`

CI runs `pnpm build` but never tests that the Dockerfile builds successfully. A Dockerfile regression would only be caught on actual deployment.

---

### LOW-005: No dependency vulnerability scanning in CI

**File:** `.github/workflows/ci.yml`

No `pnpm audit`, Snyk, or CodeQL step. Dependency vulnerabilities are not caught before release.

---

### LOW-006: `ErrorBoundary` does not log errors ✅ FIXED

**File:** `web/components/error-boundary.tsx`

> **Fix applied:** Added `componentDidCatch` that logs error message and component stack to `console.error`.

---

### LOW-007: Root page redirects based on token presence without validation ✅ FIXED

**File:** `web/app/page.tsx:16-17`

> **Fix applied:** Added JWT expiry check — decodes token, checks `exp` claim, removes expired tokens and redirects to login.

---

### LOW-008: No graceful handling of expired sessions during long page use

**File:** `web/app/dashboard/layout.tsx`

If the JWT expires while the user is on a dashboard page, the auth guard does not proactively check. The user is only redirected when the next API call returns 401.

---

## 7. Test Coverage Gaps

### Services with Zero Test Coverage

| Service                    | File                                    | Functions Untested                                                                                    |
| -------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `cloud-storage.service.ts` | `src/services/cloud-storage.service.ts` | 5 (createCloudProvider, uploadBackupToCloud, downloadFromCloud, deleteFromCloud, testCloudConnection) |
| `metrics.service.ts`       | `src/services/metrics.service.ts`       | 5 (getServerMetrics, collectMetrics, collectAllMetrics, getMetricsHistory, getNodeMetrics)            |
| `modrinth.service.ts`      | `src/services/modrinth.service.ts`      | 5 (searchMods, searchPlugins, getProject, getProjectVersions, downloadMod)                            |

### Services with Partial Coverage

| Service                   | Tested      | Untested                                            | Coverage |
| ------------------------- | ----------- | --------------------------------------------------- | -------- |
| `auth.service.ts`         | 5 functions | 15 functions (sessions, TOTP, lockout, user mgmt)   | ~25%     |
| `server.service.ts`       | 8 functions | 6 functions (start/stop/restart/clone/logs/command) | ~57%     |
| `backup.service.ts`       | 4 functions | 2 functions (createBackup, restoreBackup)           | ~67%     |
| `notification.service.ts` | 4 functions | 2 functions (sendDiscordNotification, notify)       | ~67%     |
| `schedule.service.ts`     | 7 functions | 2 functions (startTask, stopTask)                   | ~78%     |

### Middleware with No Tests

| Middleware                           | File                           | Status                                   |
| ------------------------------------ | ------------------------------ | ---------------------------------------- |
| `authMiddleware` / `adminMiddleware` | `src/middleware/auth.ts`       | No dedicated tests                       |
| `rateLimit` / `loadRateLimits`       | `src/middleware/rate-limit.ts` | Only `typeof` check (1 trivial test)     |
| `validate` / `validateQuery`         | `src/middleware/validate.ts`   | Schemas tested, middleware functions not |

### Routes with Zero Integration Test Coverage (13 of 15)

`overview`, `users`, `sessions`, `rate-limits`, `cloud-storage`, `files`, `players`, `mods`, `backups`, `nodes`, `notifications`, `schedule`, `templates`

### Missing Integration Test Scenarios

1. Full auth lifecycle: Setup → Login → Session → Revoke → Verify 401
2. 2FA flow: Setup → Login → Challenge → Verify → Disable
3. Server lifecycle: Create → Start → Verify running → Stop → Verify stopped → Restart → Delete
4. Backup lifecycle: Create → List → Restore → Download
5. Rate limiting: Send N+1 requests → Verify 429
6. Admin authorization: Non-admin attempts admin routes → Verify 403
7. Concurrent operations: Multiple server starts, backup during start

---

## 8. Frontend Issues

### FEAT-001: No frontend tests exist

There are zero test files in `web/`. No component tests, no page tests, no utility function tests, no E2E tests.

### FEAT-002: No agent tests exist

There are zero test files in `agent/`. The agent has 7 TypeScript compilation errors and no tests.

### FEAT-003: No `web/public` directory

The `web/` directory has no `public/` folder. No favicon, no robots.txt, no static assets. If added in the future, they won't be included in the Docker build.

---

## Summary

| Category               | Count                                                                    |
| ---------------------- | ------------------------------------------------------------------------ |
| Critical bugs          | 6                                                                        |
| High-severity issues   | 12                                                                       |
| Security concerns      | 10                                                                       |
| Medium-severity issues | 13                                                                       |
| Low-severity issues    | 8                                                                        |
| Test coverage gaps     | Major (3 untested services, 13 untested route modules, 0 frontend tests) |
| **Total issues**       | **52**                                                                   |

### Recommended Fix Priority (1 week timeline)

**Day 1-2: Critical bugs + Security**

- Fix BUG-001 (install.sh JWT)
- Fix BUG-002 (socket logout)
- Fix BUG-003 (login page auth context)
- Fix BUG-004 (upload timeout)
- Fix BUG-006 (unhandled rejections)
- Add ESLint config (ISSUE-008)

**Day 3-4: High-severity + Infrastructure**

- Fix Dockerfile issues (ISSUE-001 through ISSUE-003)
- Fix docker-compose (ISSUE-005, ISSUE-006)
- Add graceful shutdown (ISSUE-010)
- Fix agent TypeScript errors (typecheck results)
- Fix integration test (add `failed_logins` table)

**Day 5-6: Test coverage**

- Add tests for `metrics.service.ts`, `modrinth.service.ts`, `cloud-storage.service.ts`
- Extend existing service tests for untested functions
- Add integration tests for key routes (backups, files, players, mods, nodes)
- Fix test helper schema drift

**Day 7: Polish**

- Fix medium-severity issues
- Run full test suite
- Verify Docker build
- Final review
