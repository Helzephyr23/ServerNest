export function getJavaVersions(): string[] {
  return ["8", "11", "17", "21"];
}

export function getMcVersions(): string[] {
  return [
    "1.21.4", "1.21.3", "1.21.2", "1.21.1", "1.21",
    "1.20.6", "1.20.4", "1.20.2", "1.20.1", "1.20",
    "1.19.4", "1.19.3", "1.19.2",
    "1.18.2", "1.17.1", "1.16.5",
  ];
}

export const SOFTWARE_TYPES = [
  { id: "vanilla", name: "Vanilla", description: "Official Mojang server software" },
  { id: "paper", name: "Paper", description: "High-performance Spigot fork with bug fixes" },
  { id: "spigot", name: "Spigot", description: "CraftBukkit fork with plugin support" },
  { id: "forge", name: "Forge", description: "Mod loader for large modpacks" },
  { id: "fabric", name: "Fabric", description: "Lightweight mod loader" },
  { id: "purpur", name: "Purpur", description: "Paper fork with extra configuration" },
];
