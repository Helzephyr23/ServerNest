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

### `pnpm test` — 2 FAILED, 113 PASSED (115 total)

```
FAIL  __tests__/routes/api.integration.test.ts > Auth API Integration > POST /api/auth/login > should login with correct credentials
  expected 500 to be 200

FAIL  __tests__/routes/api.integration.test.ts > Auth API Integration > POST /api/auth/login > should reject incorrect credentials
  expected 500 to be 401
```

**Root cause:** The integration test database schema (`api.integration.test.ts:10-21`) is missing the `failed_logins` table. The login route calls `isAccountLocked(user.id)` which queries this table, throwing an unhandled SQL error that results in a 500 response.

The production `database.ts` creates this table (lines 224-233) but neither the integration test schema nor the `helpers.ts` test helper include it.

### `pnpm typecheck` — 7 TypeScript Errors (agent only)

```
agent/src/index.ts(89,43): error TS2345: Argument of type 'string | string[]' is not assignable to parameter of type 'string'.
agent/src/index.ts(131,43): error TS2345: ...
agent/src/index.ts(141,43): error TS2345: ...
agent/src/index.ts(151,43): error TS2345: ...
agent/src/index.ts(163,43): error TS2345: ...
agent/src/index.ts(187,43): error TS2345: ...
agent/src/index.ts(208,43): error TS2345: ...
```

**Root cause:** Express `req.params.id` returns `string | string[]` in Express 4 typings, but the agent passes it directly to Dockerode methods that expect `string`. All `req.params.id` usages need a type assertion or validation.

### `pnpm lint` — COMPLETELY BROKEN

```
src lint: ESLint couldn't find an eslint.config.(js|mjs|cjs) file.
web lint: No files matching the pattern "web/" were found.
```

**Root cause:** No `eslint.config.js` or equivalent file exists anywhere in the project. ESLint 9.x requires flat config. The `pnpm lint` command in CI silently fails.

---

## 2. Critical Bugs (Must Fix)

### BUG-001: `install.sh` writes JWT secret to wrong variable

**File:** `scripts/install.sh:27`
**Severity:** CRITICAL

```bash
sed -i.bak "s/change-me-to-a-random-string/$JWT_SECRET/" .env
```

The `.env.example` file has `JWT_SECRET=change-me-in-production` (line 10), but the `sed` command replaces `change-me-to-a-random-string` which only appears on the `NODE_API_KEY` line (line 24). After running `install.sh`, the JWT_SECRET **remains the insecure default** and the generated random secret is written to `NODE_API_KEY` instead.

**Fix:** Change the sed pattern to match `change-me-in-production`:

```bash
sed -i.bak "s/change-me-in-production/$JWT_SECRET/" .env
```

---

### BUG-002: Socket.IO singleton never disconnected on logout

**File:** `web/lib/auth.tsx:64-68`
**Severity:** CRITICAL

```typescript
const logout = () => {
  localStorage.removeItem("biryani_token");
  setUser(null);
  window.location.href = "/login";
};
```

The `logout()` function does not call `disconnectSocket()` from `web/lib/socket.ts`. After logout:

- The old socket with the old JWT remains connected
- `getSocket()` returns the stale socket (non-null singleton)
- Server events from the old session leak into the new session
- The new session reuses the old connection with an expired token

**Fix:** Add `import { disconnectSocket } from "./socket"` and call `disconnectSocket()` in `logout()`.

---

### BUG-003: Login page bypasses auth context

**File:** `web/app/login/page.tsx:24-29`
**Severity:** CRITICAL

```typescript
const res = await api.post("/api/auth/login", { username, password });
if (res.requiresTotp) {
  setTempToken(res.tempToken);
} else {
  localStorage.setItem("biryani_token", res.token);
  router.push("/dashboard");
}
```

The login page calls `api.post()` directly and manages `localStorage` independently. It never calls `useAuth().login()`, so:

- The auth context's `user` state is never updated on login
- After redirect to `/dashboard`, the `AuthProvider` remounts and makes an unnecessary `/api/auth/me` call
- The `login()` method in `auth.tsx:49-56` exists but is never used

**Fix:** Use `useAuth().login()` from the auth context, or remove the duplicate logic from the login page.

---

### BUG-004: `uploadFile()` has no timeout or error handling

**File:** `web/lib/api.ts:52-78`
**Severity:** HIGH

```typescript
async function uploadFile<T>(path: string, file: File): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { ... });
  // ...
}
```

Unlike `request()` which has `AbortController` + 15s timeout + network error handling, `uploadFile()`:

- Has no timeout — large uploads hang indefinitely
- Has no `AbortController` — no way to cancel
- Has no try/catch for `fetch()` — network errors produce unhandled rejections
- No loading feedback possible for the user

**Fix:** Add the same `AbortController`, timeout, and error handling pattern used in `request()`.

---

### BUG-005: Import page bypasses API wrapper entirely

**File:** `web/app/dashboard/servers/import/page.tsx`
**Severity:** HIGH

The import page uses raw `fetch()` with manual token handling instead of the `api` wrapper:

```typescript
const res = await fetch(`${apiUrl}/api/servers/import`, {
  headers: { Authorization: `Bearer ${localStorage.getItem("biryani_token")}` },
  ...
});
```

This bypasses:

- 401 handling and redirect to login
- Request timeout
- Error normalization
- Network error handling

**Fix:** Use the `api` wrapper or refactor the import endpoint to use multipart form data.

---

### BUG-006: Unhandled promise rejections in multiple pages

**File:** `web/app/dashboard/servers/page.tsx:24-33`
**Severity:** HIGH

```typescript
const handleAction = async (id: number, action: "start" | "stop" | "restart") => {
  await api.post(`/api/servers/${id}/${action}`);  // No try/catch
  fetchServers();
};

const handleDelete = async (id: number, name: string) => {
  if (!(await showConfirm(...))) return;
  await api.delete(`/api/servers/${id}`);  // No try/catch
  fetchServers();
};
```

If the API call fails, the error is an unhandled promise rejection. Same issue in:

- `web/app/dashboard/tasks/page.tsx:90-99` (`handleToggle`, `handleDelete`)
- `web/app/dashboard/servers/[id]/layout.tsx:32` (`handleAction` — errors silently swallowed)

**Fix:** Wrap all API calls in try/catch with user-facing error toasts.

---

## 3. High-Severity Issues

### ISSUE-001: Dockerfile — Both runtime containers run as root

**File:** `Dockerfile:28, 43`

Neither the `api-runtime` nor `web-runtime` stages define a non-root `USER`. Both containers run their processes as root. The web container has no reason to run as root. The API container needs Docker socket access but should still be hardened where possible.

**Fix:** Add non-root user creation and `USER` directive to both runtime stages.

---

### ISSUE-002: Dockerfile — `COPY src/` before `pnpm install` breaks layer caching

**File:** `Dockerfile:6-7`

```dockerfile
COPY src/ ./src/
RUN pnpm install --frozen-lockfile
```

Source code is copied before `pnpm install`, so any source change invalidates the install cache layer. Should be:

```dockerfile
RUN pnpm install --frozen-lockfile
COPY src/ ./src/
RUN pnpm --filter @biryani/api exec tsc
```

---

### ISSUE-003: Dockerfile — `pnpm-workspace.yaml` missing from web-runtime

**File:** `Dockerfile:46`

The `web-runtime` stage copies `package.json` and `pnpm-lock.yaml` but not `pnpm-workspace.yaml`. Since `@biryani/web` is a pnpm workspace package, `pnpm install` may fail or produce incorrect results without the workspace definition.

---

### ISSUE-004: `.dockerignore` includes test files and unused workspaces in production

**File:** `.dockerignore`

Missing entries: `scripts/`, `.github/`, `agent/`, `web/` (when building API), `src/` (when building web), `__tests__/`, `*.test.ts`, `vitest.config.ts`, `*.md`.

Test files and the entire `agent/` workspace are copied into Docker build context unnecessarily.

---

### ISSUE-005: `docker-compose.yml` — No resource limits

**File:** `docker-compose.yml`

Neither service has `mem_limit`, `cpus`, `pids_limit`, or `deploy.resources.limits`. A misbehaving Minecraft server or memory leak in the API can consume all host resources.

---

### ISSUE-006: `docker-compose.yml` — No health-aware dependency ordering

**File:** `docker-compose.yml:45-46`

```yaml
depends_on:
  - api
```

This only waits for the API container to start, not for it to be healthy. The web container may start before the API is ready. Should use:

```yaml
depends_on:
  api:
    condition: service_healthy
```

---

### ISSUE-007: `tsconfig` — `moduleResolution: "bundler"` hides ESM errors

**File:** `tsconfig.base.json:5`

The base config sets `moduleResolution: "bundler"`, which relaxes strictness that `node16`/`nodenext` resolution enforces. Since `src` uses `tsc` (not a bundler) as its build tool, this can hide invalid import paths that fail at runtime.

**Fix:** Use `moduleResolution: "node16"` or `"nodenext"` for the `src` workspace.

---

### ISSUE-008: No ESLint config file anywhere in the project

**Files:** None found (confirmed via glob search)

The `pnpm lint` script runs `eslint .` in `src/` and `eslint web/`, but ESLint 9.x requires an `eslint.config.js` file. Without one, linting either fails or runs with defaults and produces no useful output. The CI `pnpm lint` step is non-functional.

---

### ISSUE-009: `src/package.json` — `db:migrate` references non-existent file

**File:** `src/package.json:11`

```json
"db:migrate": "tsx db/migrate.ts"
```

No `db/migrate.ts` file exists anywhere in the project. Running `pnpm db:migrate` will fail with file-not-found error.

---

### ISSUE-010: No graceful shutdown handler

**File:** `src/index.ts`

The API server starts with `app.listen()` (line 94) but has no `process.on('SIGTERM', ...)` or `process.on('SIGINT', ...)` handler. When Docker sends SIGTERM during `docker stop`, in-flight requests are dropped, Socket.IO connections aren't closed cleanly, and active Docker container log streams aren't destroyed.

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

### ISSUE-012: Console page creates independent socket connection

**File:** `web/app/dashboard/servers/[id]/console/page.tsx:92-98`

The console page creates its own Socket.IO connection directly in `useEffect`, bypassing the `socket.ts` singleton. This means two concurrent socket connections may be active, and the console socket doesn't use the singleton's auth token management.

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

### SEC-006: No `Strict-Transport-Security` header

**File:** `web/next.config.ts`

The CSP headers do not include `Strict-Transport-Security`. If served over HTTPS, HSTS should be enabled.

---

### SEC-007: No rate limiting on login form (client-side)

**File:** `web/app/login/page.tsx`

No client-side debounce or rate limit on form submissions. A user or script can spam the login button. Server-side rate limiting exists but the client provides no feedback about lockouts.

---

### SEC-008: Setup page accessible without client guard

**File:** `web/app/setup/page.tsx`

The root page checks `firstRun` status and redirects to `/setup`, but the `/setup` route itself has no client-side guard. If someone navigates directly to `/setup` when setup is already complete, the form renders and submits (the server rejects it, but the UX is confusing).

---

### SEC-009: No `Permissions-Policy` header

**File:** `web/next.config.ts`

No restrictions on browser features like camera, microphone, geolocation, etc.

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

### MED-005: Socket default URL differs between `socket.ts` and `api.ts`

**Files:** `web/lib/socket.ts:10`, `web/lib/api.ts:1`

- `socket.ts`: `process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3001"`
- `api.ts`: `process.env.NEXT_PUBLIC_API_URL || ""`

In production behind a reverse proxy, the socket tries to connect directly to `localhost:3001` instead of going through the proxy.

---

### MED-006: Server context has no error state

**File:** `web/lib/server-context.tsx`

The `ServerContextType` has `server`, `loading`, and `refresh` but no `error`. Consumers cannot distinguish between "no server found (404)" and "network error". Errors are caught silently with `catch { setServer(null); }`.

---

### MED-007: Toast duration hardcoded at 5s

**File:** `web/components/toast.tsx:42-43`

Error toasts are dismissed after 5 seconds, which is too fast for users to read error messages. No way for callers to customize the duration.

---

### MED-008: Hardcoded Minecraft versions in server creation

**Files:** `web/app/dashboard/servers/new/page.tsx:19`, `web/app/dashboard/servers/import/page.tsx:20`

Minecraft versions are hardcoded as a constant array. The settings page (`settings/page.tsx`) fetches versions dynamically from `/api/mc-versions`, but the server creation page does not use this endpoint. New versions require frontend redeployment.

---

### MED-009: Duplicate `formatBytes` function with different behavior

**File:** `web/app/dashboard/servers/[id]/mods/page.tsx:13-18`

A local `formatBytes` is defined that differs from `web/lib/utils.ts`:

- Local version lacks `!bytes || bytes <= 0` guard → produces `NaN B` for zero bytes
- Local version lacks "TB" size option
- Different rounding behavior

---

### MED-010: `window.location.reload()` after version update

**File:** `web/app/dashboard/servers/[id]/settings/page.tsx:113`

After a successful version update, `window.location.reload()` destroys all React state and causes a visible flash. Should use the server context's `refresh()` instead.

---

### MED-011: Duplicate `VERSIONS` and `RAM_OPTIONS` constants

**Files:** `web/app/dashboard/servers/new/page.tsx:19-20`, `web/app/dashboard/servers/import/page.tsx:20-21`

Identical hardcoded constants are duplicated across two files. Should be extracted to a shared constants file.

---

### MED-012: `install.sh` doesn't check for `docker compose` v2

**File:** `scripts/install.sh:34`

The script uses `docker compose` (v2 syntax) but only checks for `docker` (line 8). Systems with only `docker-compose` (v1, Python-based) installed will fail.

---

### MED-013: Dockerfile hardcodes pnpm version in 4 places

**File:** `Dockerfile:3, 12, 30, 44`

`pnpm@9.15.0` is hardcoded in four places. If `package.json`'s `packageManager` field is updated without updating the Dockerfile, builds break.

---

## 6. Low-Severity Issues

### LOW-001: `declaration` and `declarationMap` generate unnecessary artifacts

**File:** `tsconfig.base.json:11-12`

The base config enables `declaration: true` and `declarationMap: true`. Since this is a private application (not a published library), generating `.d.ts` files is unnecessary overhead.

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

### LOW-006: `ErrorBoundary` does not log errors

**File:** `web/components/error-boundary.tsx`

The error boundary catches errors and displays them but does not log to any error reporting service. Errors are silently swallowed from a monitoring perspective.

---

### LOW-007: Root page redirects based on token presence without validation

**File:** `web/app/page.tsx:16-17`

```typescript
const token = localStorage.getItem("biryani_token");
if (token) {
  router.replace("/dashboard");
}
```

An expired or malformed token passes this check, causing a redirect to dashboard only to be redirected back to login by the auth guard. Creates a flash of unauthenticated content.

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
