<div align="center">

# 🍛 Biryani

**Free, self-hosted Minecraft server management panel**

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square)](LICENSE)
[![Docker](https://img.shields.io/badge/docker-ready-2496ED?style=flat-square&logo=docker&logoColor=white)](#quick-start)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-339933?style=flat-square&logo=node.js&logoColor=white)](#quick-start)

</div>

---

Biryani is a **free, open-source, self-hosted** panel for managing Minecraft servers. Think Aternos, but you run it on your own machine. Think Crafty Controller, but with a modern UI, built-in mod marketplace, and multi-node clustering.

### Features

- **🖥️ Server Management** — Create, start, stop, restart Minecraft servers with one click
- **📦 Mod Marketplace** — Browse and discover mods/plugins from Modrinth directly in the panel
- **🌐 Multi-Node Cluster** — Manage servers across multiple machines from one dashboard
- **📊 Live Metrics** — CPU, RAM, and player count monitoring per server
- **💾 Backups** — Create, restore, and download server backups
- **🔧 Live Console** — Real-time console output and command input
- **👥 Player Management** — Whitelist, OP, and ban management
- **🐳 Docker Isolation** — Each server runs in its own Docker container
- **🔒 Secure** — JWT authentication with Argon2 password hashing
- **🎨 Modern UI** — Built with Next.js, Tailwind CSS, and shadcn/ui

### Supported Software

| Software | Status |
|----------|--------|
| Vanilla | ✅ |
| Paper | ✅ |
| Spigot | ✅ |
| Forge | ✅ |
| Fabric | ✅ |
| Purpur | ✅ |
| Bedrock | ✅ (via Docker) |

---

## Quick Start

### Docker Compose (Recommended)

```bash
git clone https://github.com/yourusername/biryani.git
cd biryani
cp .env.example .env
# Edit .env and set a secure JWT_SECRET
docker compose up -d
```

Open **http://localhost:3000** and follow the setup wizard.

### Manual Setup

**Requirements:** Node.js 20+, pnpm, Docker

```bash
git clone https://github.com/yourusername/biryani.git
cd biryani
pnpm install
cp .env.example .env
# Edit .env
pnpm dev
```

Open **http://localhost:3000**.

---

## Architecture

```
┌─────────────────────────────────┐
│         Biryani Panel           │
│  ┌───────────┐  ┌────────────┐  │
│  │  Next.js   │  │   Fastify  │  │
│  │  Frontend  │◄─┤    API     │  │
│  │  :3000     │  │   :3001    │  │
│  └───────────┘  └─────┬──────┘  │
│                        │         │
│                ┌───────┴──────┐  │
│                │ Docker Mgmt  │  │
│                │ (dockerode)  │  │
│                └───────┬──────┘  │
└────────────────────────┼────────┘
                         │
            ┌────────────┼────────────┐
            ▼            ▼            ▼
     ┌────────────┐ ┌────────────┐ ┌────────────┐
     │   Agent    │ │   Agent    │ │   Agent    │
     │  Node 1    │ │  Node 2    │ │  Node 3    │
     └────────────┘ └────────────┘ └────────────┘
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js + TypeScript + Fastify |
| Frontend | Next.js 15 + Tailwind CSS + shadcn/ui |
| Database | SQLite |
| Auth | JWT + Argon2 |
| Containers | Docker (itzg/minecraft-server) |
| Real-time | Socket.IO |
| Mods | Modrinth API |
| Agent | Express + dockerode |

---

## Multi-Node Setup

1. Deploy the agent on each remote machine:

```bash
cd agent
cp .env.example .env
# Set NODE_API_KEY to a shared secret
pnpm install && pnpm start
```

2. Register the node in the panel under **Nodes → Add Node**

3. Assign servers to specific nodes when creating them

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PANEL_HOST` | `127.0.0.1` | Panel bind address |
| `PANEL_PORT` | `3000` | Panel port |
| `API_PORT` | `3001` | API port |
| `JWT_SECRET` | - | Secret for JWT tokens (change this!) |
| `DATABASE_PATH` | `./data/biryani.db` | SQLite database path |
| `DOCKER_IMAGE` | `itzg/minecraft-server` | Default Docker image |
| `SERVER_PORT_RANGE_START` | `25565` | Start of MC server port range |
| `SERVER_PORT_RANGE_END` | `25665` | End of MC server port range |

---

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting a PR.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing`)
5. Open a Pull Request

---

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Built with ❤️ for the Minecraft community**

</div>
