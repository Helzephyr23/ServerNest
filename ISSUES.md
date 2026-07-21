# Known Issues & Technical Debt

This document tracks known bugs, limitations, and areas of technical debt in Biryani. It serves as a reference for contributors and users encountering unexpected behavior.

## Technical Debt

### Code Quality

- **~29 `as any` usages** — Remaining occurrences are in external service clients (`cloud-storage.service.ts`), query parameter casts, and test files where full typing is low-priority.
- **Missing Zod validation** — Remaining gaps: `schedule.ts`, `notifications.ts`, `cloud-storage.ts`, query parameter validation (no route validates query params with Zod).

### Infrastructure

- **Unpinned dependencies** — `pnpm-lock.yaml` is versioned, but `package.json` version ranges are wide. Consider running `pnpm audit` before release.
