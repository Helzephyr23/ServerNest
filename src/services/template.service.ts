export interface ServerTemplate {
  id: string;
  name: string;
  description: string;
  software: string;
  image: string;
  default_ram_mb: number;
  env: Record<string, string>;
  recommended_version?: string;
  icon: string;
}

export const templates: ServerTemplate[] = [
  {
    id: "vanilla",
    name: "Vanilla",
    description: "Standard Minecraft server from Mojang",
    software: "vanilla",
    image: "itzg/minecraft-server",
    default_ram_mb: 2048,
    env: { TYPE: "VANILLA" },
    icon: "⛏️",
  },
  {
    id: "paper",
    name: "Paper",
    description: "High-performance fork with plugin support",
    software: "paper",
    image: "itzg/minecraft-server",
    default_ram_mb: 3072,
    env: { TYPE: "PAPER" },
    icon: "📄",
  },
  {
    id: "spigot",
    name: "Spigot",
    description: "CraftBukkit fork with performance improvements",
    software: "spigot",
    image: "itzg/minecraft-server",
    default_ram_mb: 3072,
    env: { TYPE: "SPIGOT" },
    icon: "🔧",
  },
  {
    id: "purpur",
    name: "Purpur",
    description: "Paper fork with extra configuration options",
    software: "purpur",
    image: "itzg/minecraft-server",
    default_ram_mb: 3072,
    env: { TYPE: "PURPUR" },
    icon: "🟣",
  },
  {
    id: "forge",
    name: "Forge",
    description: "Mod loader for Minecraft",
    software: "forge",
    image: "itzg/minecraft-server",
    default_ram_mb: 4096,
    env: { TYPE: "FORGE" },
    icon: "🔨",
  },
  {
    id: "fabric",
    name: "Fabric",
    description: "Lightweight mod loader for Minecraft",
    software: "fabric",
    image: "itzg/minecraft-server",
    default_ram_mb: 3072,
    env: { TYPE: "FABRIC" },
    icon: "🧵",
  },
  {
    id: "neoforge",
    name: "NeoForge",
    description: "Community-driven mod loader",
    software: "neoforge",
    image: "itzg/minecraft-server",
    default_ram_mb: 4096,
    env: { TYPE: "NEOFORGE" },
    icon: "🆕",
  },
  {
    id: "bedrock",
    name: "Bedrock",
    description: "Minecraft Bedrock Edition server",
    software: "bedrock",
    image: "itzg/minecraft-bedrock-server",
    default_ram_mb: 2048,
    env: {},
    icon: "📱",
  },
  {
    id: "sponge",
    name: "Sponge",
    description: "Modding platform for Minecraft",
    software: "sponge",
    image: "itzg/minecraft-server",
    default_ram_mb: 4096,
    env: { TYPE: "SPONGE" },
    icon: "🧽",
  },
  {
    id: "bungeecord",
    name: "BungeeCord",
    description: "Proxy server for connecting multiple servers",
    software: "bungeecord",
    image: "itzg/bungeecord",
    default_ram_mb: 1024,
    env: {},
    icon: "🔗",
  },
  {
    id: "velocity",
    name: "Velocity",
    description: "Next-generation Minecraft proxy",
    software: "velocity",
    image: "itzg/velocity",
    default_ram_mb: 1024,
    env: {},
    icon: "⚡",
  },
];

export function getTemplate(id: string): ServerTemplate | undefined {
  return templates.find((t) => t.id === id);
}

export function getAllTemplates(): ServerTemplate[] {
  return templates;
}
