# Contributing to ServerNest

Thanks for your interest in improving ServerNest. This document covers how to get set up, what we look for in a pull request, and the ground rules for the project.

By participating you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).

## Getting Started

### Prerequisites

- **Node.js >= 20** (CI runs Node 22)
- **pnpm 9.x** — this is a pnpm monorepo; please don't use npm or yarn
- **Docker** — ServerNest manages Minecraft servers as containers, so Docker is needed to run the panel locally

### Setup

```bash
git clone https://github.com/Helzephyr23/servernest.git
cd servernest
pnpm install
cp .env.example .env
```

Edit `.env` and set a real `JWT_SECRET`. The API refuses to boot with the default placeholder value, so this step is mandatory:

```bash
openssl rand -base64 48
```

### Branches

| Branch | Purpose |
|--------|---------|
| `main` | Production. Only receives merges that pass CI. |
| `dev` | Default development branch. Branch from here. |
| `feat/**` | Feature branches. CI also runs on these. |

## Development Workflow

```bash
pnpm dev          # API on :3001 + frontend on :3000
pnpm test         # All unit/integration tests
pnpm test:watch   # Watch mode
pnpm lint         # ESLint across all packages
pnpm typecheck    # tsc --noEmit across all packages
pnpm build        # Production build
```

Before opening a pull request, run the full gate locally — it's exactly what CI runs:

```bash
pnpm audit --audit-level high
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<optional scope>): <description>
```

Valid types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`.

```
feat(backups): add scheduled backup rotation
fix(mods): respect server loader when checking for updates
docs(readme): clarify node agent setup
chore: pin dependency versions
```

Scope should name the affected area (`web`, `api`, `agent`, `mods`, `backups`, `auth`) when it's narrow.

## Pull Requests

1. **Branch from `dev`**, not `main`. (`main` is the repository's default branch and the production line; `dev` is where ongoing work accumulates.)
2. **Keep the diff focused.** One logical change per PR. Unrelated refactors and features make review much harder.
3. **Add tests.** New behavior needs coverage. Bug fixes need a regression test that fails without your patch. Tests use Vitest against in-memory SQLite with Docker and external services mocked — no live Docker or network required.
4. **Match the surrounding code style.** Run `pnpm lint` and fix new warnings. The codebase has a pre-existing backlog of `no-explicit-any` warnings; please don't add to it, and feel free to reduce it in files you touch.
5. **Write a clear description.** Explain *why*, not just *what*. Note any config, migration, or deployment implications.
6. **CI must be green.** Lint, typecheck, tests, and the Docker build all run on every PR.

## Architecture Notes

A few things worth knowing before you change something:

- **File and player operations run inside the Minecraft container** via `docker exec`, not on the host. Shared helpers live in `src/utils/container.ts` (`execInContainer`, `writeInContainer`).
- **Never build shell strings by interpolation** for container commands. Use the shared helpers and pipe content over stdin.
- **API routes live in `src/routes/`, business logic in `src/services/`.** Keep route handlers thin; they should validate with Zod and delegate.
- **Every mutating route needs `authMiddleware`** and should check role/ownership.
- **Input validation is Zod**, with schemas defined in `src/middleware/validate.ts`. Add new schemas there rather than hand-rolling checks.
- **The frontend is same-origin.** Next.js proxies `/api/*` and `/socket.io/*` to the API, so there's no `NEXT_PUBLIC_API_URL` in play. See `web/lib/api.ts`.
- **Remote nodes** are managed by a separate agent service in `agent/`, authenticated with a shared `x-api-key`. See `src/services/node.service.ts`.

## Reporting Bugs

Open an issue with:

- ServerNest version or commit SHA
- Deployment method (Docker Compose, local, agent)
- Steps to reproduce
- Expected vs. actual behavior
- Relevant logs — please **redact tokens, passwords, `JWT_SECRET`, and cloud credentials**

If a bug involves authentication, file access, or anything that could let someone reach your host, report it privately instead. See [SECURITY.md](SECURITY.md).

## Reporting Security Issues

**Do not open a public issue for a security vulnerability.** Use GitHub's private vulnerability reporting via the **Security** tab. Full details and response timelines are in [SECURITY.md](SECURITY.md).

## License

ServerNest is licensed under [GPL-3.0-only](LICENSE). By contributing, you agree that your contributions are licensed under the same terms.
