# Known Issues & Technical Debt

This document tracks known bugs, limitations, and areas of technical debt in Biryani. It serves as a reference for contributors and users encountering unexpected behavior.

## Technical Debt

### Code Quality

- **~4 `as any` usages** — Remaining occurrences are exclusively in test files (`__tests__/services/`) where full typing is low-priority. All route and service files are now clean.

### Infrastructure

- **5 dependency vulnerabilities** — 2 high (`fast-uri` via fastify transitive deps), 1 high (`sharp` via next), 1 moderate (`postcss` via next), 1 moderate (`uuid` via dockerode). See `pnpm audit` output for remediation paths.
- **Unpinned dependencies** — `pnpm-lock.yaml` is versioned, but `package.json` version ranges are wide.
