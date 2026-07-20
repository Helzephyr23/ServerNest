# Known Issues & Technical Debt

This document tracks known bugs, limitations, and areas of technical debt in Biryani. It serves as a reference for contributors and users encountering unexpected behavior.

## Known Bugs

### Pre-existing Test Failure

**Test:** `api.integration.test.ts` — "should login with correct credentials"
**Status:** Unresolved (pre-existing, not caused by recent changes)
**Description:** Returns HTTP 500 instead of 200 on successful login. Likely a test isolation issue (database state leaking between tests) rather than an authentication logic bug.

## Technical Debt

### Code Quality
- **~100+ `as any` usages** — Widespread in route handlers. Should be replaced with proper TypeScript types.
- **Python JSON manipulation in `players.ts`** — Uses `python3 -c` to parse `ops.json`/`whitelist.json` instead of native JSON parsing. Fragile and adds a Python runtime dependency.
- **Missing Zod validation** — Several routes lack Zod schema validation (import, update, config endpoints).
- **`console.log` in agent** — The node agent uses raw `console.log` instead of a structured logger.

### Infrastructure
- **No CI/CD pipeline** — `.github/workflows/` exists but is empty. No automated tests on push/PR.
- **Unpinned dependencies** — `pnpm-lock.yaml` is versioned, but `package.json` version ranges are wide. Consider running `pnpm audit` before release.

### Security (Post-Launch)
- **No brute-force protection** — Login endpoint has no account lockout or rate limiting on password attempts.
- **TOTP secrets not encrypted at rest** — Stored in plaintext in SQLite.
- **No `helmet` integration** — Fastify app uses manual CSP headers instead of `@fastify/helmet`.
