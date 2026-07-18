# Biryani Issues

> Known bugs, problems, and technical debt.
> Friend — add bugs you find here as you go. Remove items once fixed.

---

## Critical
*(blocks usage or risks data loss — fix immediately)*

- **Path Traversal in File Operations** — User-controlled `path` query param is concatenated directly into `/data/${path}` with no `..` filtering. A request like `?path=../../.env` reads arbitrary files from the container. Affects GET list, GET content, PUT content, DELETE, and mkdir endpoints. [src/routes/files.ts:35,58,100]

- **Path Traversal in File Upload** — The multipart filename is used as-is in `join(serverDataDir, filePath)`. A filename like `../../.env` writes arbitrary files to the host filesystem. [src/routes/files.ts:169]

- **Path Traversal in File Download** — Same as upload — `join(serverDataDir, filePath)` with no sanitization. Can read `.env` with JWT_SECRET, database, or any host file. [src/routes/files.ts:193]

- **Command Injection in File Write** — `filePath` from user input is interpolated into a bash command: `echo '${b64}' | base64 -d > /data/${filePath}`. Shell metacharacters in `filePath` can break out of the intended path. [src/routes/files.ts:73]

- **Node Heartbeat API Key Never Verified** — The `/api/nodes/heartbeat` endpoint extracts `api_key` from the body but never checks it. Anyone can spoof heartbeats and metrics for any node. Also, `getNodeById(Number(name))` converts a string name like `"master"` to `NaN`, so the lookup always fails. [src/routes/nodes.ts:63-72]

- **Installed Mods Table Schema Mismatch** — Route inserts `(server_id, mod_slug, version_id, filename)` but the schema defines `(server_id, mod_name, filename, version, source)`. The INSERT always fails silently (empty `catch {}`). Installed mods are never tracked. [src/routes/mods.ts:77 vs src/config/database.ts:109-118]

---

## High Priority
*(significant functionality broken, but workarounds exist)*

- **Double GZip in Backup Creation** — `tar czf` already gzips output, but the pipeline pipes it through `createGzip()` again. Produces `.tar.gz.gz`. Restore decompresses only one layer. Backup files are corrupted and larger than needed. [src/services/backup.service.ts:44-50]

- **Race Condition in Port Allocation** — `findAvailablePort()` reads all used ports then inserts a new server. Two concurrent create requests can pick the same port. No transaction wraps the read+insert. [src/services/server.service.ts:237-242]

- **CORS Allows All Origins** — `origin: true` reflects the request origin, allowing any site to make credentialed requests. Socket.IO uses `origin: "*"`. Enables cross-site token theft. [src/index.ts:32,59]

- **No Validation on Server Config Update** — `PUT /api/servers/:id/config` accepts arbitrary `key`/`value` pairs with no validation. Values are used as Docker env vars in `startServer`, allowing injection of `EULA=`, `VERSION=`, or custom env vars. [src/routes/servers.ts:144-149]

- **Status Polling Marks Multi-Node Servers Stopped** — The status check runs `docker.inspect()` against the local Docker daemon for ALL servers regardless of `node_id`. Remote node servers always fail inspect and get incorrectly marked as stopped. [src/index.ts:89-112]

- **Unbounded `tail` Parameter DoS** — `?tail=999999999` forces Docker to return a massive log buffer with no upper bound check. [src/routes/servers.ts:121]

- **`deleteServer` Doesn't Decrement Node `current_servers`** — After deleting a server, the node's `current_servers` count is never decremented. Over time, nodes appear full when they aren't. [src/services/server.service.ts:73-79]

- **No Server Ownership/Permission Check on Endpoints** — Any authenticated user can access any server's data: execute RCON commands, read files, manage backups, delete servers. No admin check or server ownership verification. [src/routes/servers.ts, backups.ts, files.ts, players.ts, mods.ts]

---

## Low Priority
*(minor glitches, edge cases, cosmetic issues)*

- **`api.ts` Crashes on Non-JSON Error Responses** — `res.json()` is called unconditionally. Backend proxy errors (502 HTML pages, nginx errors) throw a cryptic `SyntaxError: Unexpected token <` instead of a meaningful error. [web/lib/api.ts:26]

- **Console Creates Duplicate Socket Connection** — Console page creates its own `io()` connection instead of using the shared `getSocket()` from `lib/socket.ts`. Two WebSocket connections are maintained simultaneously. [web/app/dashboard/servers/[id]/console/page.tsx:92-99]

- **`installingMod` State Never Set During Install** — The marketplace page tracks `installingMod` state but never sets it during install. The install button never shows a loading/disabled state. [web/app/dashboard/marketplace/page.tsx:68-80]

- **No Error Handling on Server Actions** — `handleAction` and `handleDelete` in the servers list page have no try/catch. Failed start/stop/restart/delete shows no feedback and the list may not refresh. [web/app/dashboard/servers/page.tsx:22-32]

- **`JSON.parse(notif.events)` Crashes on Malformed Data** — If `notif.events` is non-JSON from the database, the notification page crashes with no try/catch fallback. [web/app/dashboard/notifications/page.tsx:188]

- **`updateServer` Silently Drops Falsy Values** — `if (data.ram_mb)` treats `0` as falsy. Cannot set RAM to 0 or clear optional fields. [src/services/server.service.ts:65]

- **Inconsistent `execInContainer` Implementations** — `files.ts` uses `dockerStreamDemux` (correct), but `players.ts` uses raw `stream.on("data")` with regex filtering, which misparses Docker's multiplexed stream headers. [src/routes/files.ts:8-24 vs src/routes/players.ts:6-24]

---

## Technical Debt
*(refactoring, missing tests, code quality improvements)*

- **Toast System Mounted But Never Used** — `ToastProvider` is mounted in dashboard layout, but `useToast()` is never imported anywhere. All pages use `alert()` or inline error state instead. Dead infrastructure. [web/app/dashboard/layout.tsx:4]

- **`formatBytes` Duplicated in 3 Files** — Canonical version in `lib/utils.ts`, local copies in `files/page.tsx:226` and `mods/page.tsx:10`. The copies only handle up to GB while the original handles TB. Different pages format the same value differently.

- **No React Error Boundaries** — If any component throws during render, the entire app crashes to a white screen with no recovery.

- **Missing Graceful Shutdown** — No `SIGTERM`/`SIGINT` handlers. Docker log streams are left dangling, SQLite WAL may not checkpoint, Socket.IO connections aren't drained, `setInterval` timers aren't cleared. [src/index.ts]

- **Rate Limiter Off-By-One** — The first request that passes the check increments the counter, making the actual limit `maxRequests + 1` for the first window cycle. [src/middleware/rate-limit.ts:16-23]

- **Duplicate Token Storage Logic** — Login page stores token directly in localStorage, while `auth.tsx` has its own `login` function doing the same thing. Two code paths for the same operation. [web/app/login/page.tsx:23 vs web/lib/auth.tsx:49]

---

> **Format:**
> ```
> - **Title** — Brief description. [file/path:line]
>   More context or reproduction steps if needed.
> ```
