# Biryani — Remaining Issues & Backlog

> **Updated:** 2026-08-25
> All critical bugs, high-severity issues, security fixes, and test coverage gaps are resolved.
> This document tracks the remaining post-launch backlog only.
> Full history of resolved items lives in git history (`git log --oneline`) and prior revisions of this file.

## Status Snapshot

| Check | Status |
| ----- | ------ |
| Tests | 445 passing (362 api + 52 web + 31 agent) |
| Typecheck | Clean across all workspaces |
| Lint | 0 errors (~191 `no-explicit-any` warnings) |
| Test DB schema | Single source: `src/__tests__/schema.ts` |
| CI | lint → typecheck → tests → coverage → build → Docker image → `pnpm audit` |
| Known dependency vulnerabilities | 0 |

---

## Security (remaining)

### SEC-003: CSP only applied in production ✅ DOCUMENTED

**File:** `web/next.config.ts:30`

> **Status:** Intentional. Next.js dev mode injects inline scripts for Webpack HMR which would be blocked by `script-src 'self'`. A comment in `next.config.ts` documents this is not an oversight.

---

### SEC-004: `'unsafe-inline'` in CSP `style-src` ✅ DOCUMENTED

**File:** `web/next.config.ts:10`

> **Status:** Required by Next.js CSS modules and shadcn/ui inline style props. A comment in `next.config.ts` documents this as an accepted trade-off.

---

### SEC-005: Docker socket mount with no mitigation ✅ PARTIALLY FIXED

**File:** `docker-compose.yml:27`

> **Fix applied:** Added inline security warning comment. Full mitigation (socket proxy, rootless Docker) documented as post-launch item.

**Remaining:** Mount the Docker socket through a socket proxy or run rootless Docker so panel compromise doesn't equal host compromise. (Deployment-dependent — cannot be fixed in code alone.)

---

### SEC-007: Login double-submit protection ✅ FIXED

**File:** `web/app/login/page.tsx`

> **Fix applied:** Added `useRef` submission guard to both login and TOTP forms, preventing duplicate requests from rapid double-clicks.

---

## Test Coverage Gaps — RESOLVED

All 26 untested functions and web component tests are now implemented:

| Service                   | Before | After  | Status |
| ------------------------- | ------ | ------ | ------ |
| `auth.service.ts`         | 20 tests | 35 tests | ✅ All 13 missing functions covered |
| `server.service.ts`       | 17 tests | 28 tests | ✅ All 6 missing functions covered |
| `backup.service.ts`       | 10 tests | 13 tests | ✅ createBackup + restoreBackup covered |
| `notification.service.ts` | 7 tests  | 15 tests | ✅ sendDiscordNotification + notify covered |
| `schedule.service.ts`     | 12 tests | 17 tests | ✅ startTask + stopTask + startAllTasks covered |
| Web: login form           | 0 tests  | 6 tests  | ✅ Login, TOTP, double-submit, error handling |
| Web: auth context         | 0 tests  | 3 tests  | ✅ Loading, user set, 401 handling |
| Web: dashboard guard      | 0 tests  | 3 tests  | ✅ Redirect, loading, authenticated render |

### Integration Test Scenarios

All 7 planned e2e scenarios are implemented in `src/__tests__/routes/e2e.integration.test.ts`:
1. ✅ Full auth lifecycle: Setup → Login → Session → Revoke → Verify 401
2. ✅ 2FA flow: Setup → Login → Challenge → Verify → Disable
3. ✅ Server lifecycle: Create → Start → Running → Stop → Stopped → Restart → Delete
4. ✅ Backup lifecycle: Create → List → Restore → Delete
5. ✅ Rate limiting rules: CRUD lifecycle + non-admin blocked
6. ✅ Admin authorization: Systematic sweep of all admin-only routes
7. ✅ Concurrent operations: Parallel starts, backups, unique port allocation

---

## Suggested Priority

1. ~~**Service test coverage** — auth, server, backup, notification, schedule (26 untested functions)~~ ✅ DONE
2. ~~**Web component tests** — login form, auth context, dashboard guards~~ ✅ DONE
3. **SEC-005** — socket proxy / rootless Docker when deployment allows
