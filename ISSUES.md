# Biryani — Remaining Issues & Backlog

> **Updated:** 2026-08-21
> All critical bugs, high-severity issues, and security fixes are resolved. This document tracks the remaining post-launch backlog only.
> Full history of resolved items lives in git history (`git log --oneline`) and prior revisions of this file.

## Status Snapshot

| Check | Status |
| ----- | ------ |
| Tests | 179 passing (unit + integration) |
| Typecheck | Clean across all workspaces |
| Lint | 0 errors (~147 `no-explicit-any` warnings) |
| CI | lint → typecheck → tests → coverage → build → Docker image → `pnpm audit` |
| Known dependency vulnerabilities | 0 |

---

## Security (remaining)

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

### SEC-005: Docker socket mount with no mitigation ✅ PARTIALLY FIXED

**File:** `docker-compose.yml:27`

> **Fix applied:** Added inline security warning comment. Full mitigation (socket proxy, rootless Docker) documented as post-launch item.

**Remaining:** Mount the Docker socket through a socket proxy or run rootless Docker so panel compromise doesn't equal host compromise.

---

### SEC-007: No rate limiting on login form (client-side)

**File:** `web/app/login/page.tsx`

No client-side debounce or rate limit on form submissions. A user or script can spam the login button. Server-side rate limiting exists but the client provides no feedback about lockouts.

---

## Medium

### MED-003: Three separate test DB schemas with drift

**Files:** `src/__tests__/helpers.ts`, `src/__tests__/routes/api.integration.test.ts`, `src/__tests__/services/node.service.test.ts`

Three locations define the test database schema manually, kept in sync by hand. They have already drifted — the integration test is missing `failed_logins`, `cloud_storage_configs`, `backup_uploads`, `server_metrics`, and `slug` on `installed_mods`.

**Fix:** Extract a single shared schema builder and use it everywhere. Do this before writing more tests.

---

## Low

### LOW-002: `src/package.json` heavy dependencies loaded eagerly

**File:** `src/package.json`

`googleapis` (173MB+ dependency tree), `dropbox`, `otplib`, `qrcode`, `@aws-sdk/client-s3`, and `@aws-sdk/lib-storage` are all loaded eagerly at startup even if the features are not configured. Dynamic imports would reduce startup time and Docker image size.

> Note: web-side lazy loading (recharts, xterm) is done; this item is API-side only.

---

## Feature Work

### FEAT-001: No frontend tests exist

There are zero test files in `web/`. No component tests, no page tests, no utility function tests, no E2E tests.

### FEAT-002: No agent tests exist

There are zero test files in `agent/`. The agent has 7 TypeScript compilation errors and no tests.

---

## Test Coverage Gaps

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

### Missing Integration Test Scenarios

1. Full auth lifecycle: Setup → Login → Session → Revoke → Verify 401
2. 2FA flow: Setup → Login → Challenge → Verify → Disable
3. Server lifecycle: Create → Start → Verify running → Stop → Verify stopped → Restart → Delete
4. Backup lifecycle: Create → List → Restore → Download
5. Rate limiting: Send N+1 requests → Verify 429
6. Admin authorization: Non-admin attempts admin routes → Verify 403
7. Concurrent operations: Multiple server starts, backup during start

---

## Suggested Priority

1. **MED-003** — consolidate test DB schemas first, so new tests don't deepen the drift
2. **FEAT-001 / FEAT-002** — frontend and agent test suites (biggest structural gap)
3. **Service unit tests** — cloud-storage, metrics, modrinth (0% coverage)
4. **LOW-002** — lazy-load heavy API dependencies
5. **SEC-005** — socket proxy / rootless Docker when deployment allows
6. **SEC-003 / SEC-004 / SEC-007** — CSP and login UX polish
