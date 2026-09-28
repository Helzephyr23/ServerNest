# ServerNest Roadmap

> Future features, enhancements, and planned work.

---

## Phase 6 — Security & Reliability

- [x] **2FA / TOTP authentication** — Time-based one-time passwords for login
- [ ] **API key management** — Generate scoped API keys for external tool integration
- [x] **Cloud backup targets** — S3, Google Drive, Dropbox
- [x] **Rate limit config UI** — DB-configurable per-route rate limits
- [x] **Session management** — View and revoke active sessions

## Phase 7 — Multi-User & UX

- [x] **User management UI** — Invite, remove, and assign roles to users
- [x] **Dark mode / theme toggle** — System-default + manual light/dark switch
- [ ] **PWA support** — Installable as a progressive web app with offline fallback
- [x] **Responsive improvements** — Mobile-friendly layouts throughout dashboard
- [ ] **Keyboard shortcuts** — Power-user shortcuts for common actions

## Phase 8 — Monitoring & QoL

- [x] **Historical performance graphs** — CPU, RAM, disk usage over time (Recharts)
- [ ] **More notification channels** — Email (SMTP), Slack, Telegram, Pushover
- [x] **Batch mod install** — Select and install multiple mods/plugins at once
- [x] **Server cloning** — Duplicate a server's config, mods, and settings
- [x] **Server version auto-updater** — One-click update Minecraft version with safety checks
- [x] **Mod update checking** — Check Modrinth for updates and update with one click
- [x] **Server import** — Migrate servers from zip/tar.gz archives with auto-detection

## Phase 9 — Polish & Ecosystem

- [x] **E2E tests** — Playwright tests covering core user flows
- [x] **Server search & filter** — Filter servers by status, name, or software
- [x] **Audit log** — Track all administrative actions with full history
- [x] **Admin account recovery** — Password reset via setup page
- [x] **Last-admin guard** — Prevent deletion of last admin user
- [ ] **World management** — Pre-generate chunks, prune unused regions, download world
- [ ] **Dedicated documentation site** — Separate from README (Docusaurus or VitePress)
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
