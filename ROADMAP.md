# Biryani Roadmap

> Future features, enhancements, and planned work beyond Phase 5.

---

## Phase 6 — Security & Reliability

- [ ] **2FA / TOTP authentication** — Time-based one-time passwords for login
- [ ] **API key management** — Generate scoped API keys for external tool integration
- [ ] **Cloud backup targets** — S3, Backblaze B2, Google Drive, etc.
- [ ] **Rate limit config UI** — Let admins customize rate limits per route
- [ ] **Session management** — View and revoke active sessions

## Phase 7 — Multi-User & UX

- [x] **User management UI** — Invite, remove, and assign roles to users
- [x] **Dark mode / theme toggle** — System-default + manual light/dark switch
- [ ] **PWA support** — Installable as a progressive web app with offline fallback
- [ ] **Responsive improvements** — Better tablet and mobile layouts
- [ ] **Keyboard shortcuts** — Power-user shortcuts for common actions

## Phase 8 — Monitoring & QoL

- [ ] **Historical performance graphs** — CPU, RAM, disk usage over time (Chart.js or similar)
- [ ] **More notification channels** — Email (SMTP), Slack, Telegram, Pushover
- [ ] **Batch mod install** — Select and install multiple mods/plugins at once
- [ ] **Server cloning** — Duplicate a server's config, mods, and settings
- [ ] **Server version auto-updater** — One-click update Minecraft version with safety checks

## Phase 9 — Polish & Ecosystem

- [ ] **E2E tests** — Playwright or Cypress tests covering core user flows
- [ ] **Import tool** — Migrate servers from Crafty Controller, Pterodactyl, AMP
- [ ] **World management** — Pre-generate chunks, prune unused regions, download world
- [ ] **Dedicated documentation site** — Separate from README (Docusaurus or VitePress)
- [ ] **Plugin/mod auto-update** — Check Modrinth for updates and notify/install
- [ ] **Server crash detection & auto-restart** — Detect crashes and optionally restart

## Phase 10 — Advanced Features

- [ ] **Server groups / folders** — Organize servers into groups in the dashboard
- [ ] **Resource pack manager** — Upload and assign resource packs to servers
- [ ] **Network-level player sync** — Shared whitelist/ops across multiple servers
- [ ] **Custom Docker images** — Let users specify their own Docker images
- [ ] **Web terminal for node SSH** — SSH into the host machine from the panel
- [ ] **Plugin/mod dependencies** — Resolve and install required dependencies

## Backlog

- **Home screen CPU/RAM gauges** — Visual progress bars for per-server CPU and memory usage on dashboard
- **Console page layout** — Show server tabs (Files, Mods, Players, etc.) alongside the console terminal
- **Google Drive backup target** — Covered under Phase 6 (Cloud backup targets)

---

> **Legend:** `[ ]` — Planned / Not started | `[x]` — Completed
> Items within each phase are unordered — pick whatever interests you most.
