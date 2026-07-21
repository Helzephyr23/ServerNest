import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";

const MODRINTH_API = "https://api.modrinth.com/v2";

export interface ModrinthProject {
  slug: string;
  title: string;
  description: string;
  downloads: number;
  icon_url: string | null;
  categories: string[];
  versions: string[];
  server_side: string;
  client_side: string;
  project_type: string;
}

export interface ModrinthVersion {
  id: string;
  project_id: string;
  name: string;
  version_number: string;
  game_versions: string[];
  loaders: string[];
  files: {
    url: string;
    filename: string;
    size: number;
  }[];
}

export async function searchMods(
  query: string,
  mcVersion?: string,
  loader?: string,
  limit: number = 20
): Promise<ModrinthProject[]> {
  const facets: string[][] = [["project_type:mod"], ["server_side:required", "server_side:optional"]];
  if (mcVersion) facets.push([`versions:${mcVersion}`]);
  if (loader) facets.push([`categories:${loader}`]);

  const params = new URLSearchParams({
    query,
    limit: limit.toString(),
    facets: JSON.stringify(facets),
  });

  const res = await fetch(`${MODRINTH_API}/search?${params}`);
  const data = await res.json();
  return data.hits || [];
}

export async function searchPlugins(
  query: string,
  mcVersion?: string,
  limit: number = 20
): Promise<ModrinthProject[]> {
  const facets: string[][] = [["project_type:plugin"]];
  if (mcVersion) facets.push([`versions:${mcVersion}`]);

  const params = new URLSearchParams({
    query,
    limit: limit.toString(),
    facets: JSON.stringify(facets),
  });

  const res = await fetch(`${MODRINTH_API}/search?${params}`);
  const data = await res.json();
  return data.hits || [];
}

export async function getProject(slug: string): Promise<any> {
  const res = await fetch(`${MODRINTH_API}/project/${slug}`);
  if (!res.ok) throw new Error("Project not found");
  return res.json();
}

export async function getProjectVersions(
  slug: string,
  mcVersion?: string,
  loader?: string
): Promise<ModrinthVersion[]> {
  const params = new URLSearchParams();
  if (mcVersion) params.set("game_versions", JSON.stringify([mcVersion]));
  if (loader) params.set("loaders", JSON.stringify([loader]));

  const res = await fetch(`${MODRINTH_API}/project/${slug}/version?${params}`);
  const data = await res.json();
  return data || [];
}

export async function downloadMod(
  versionId: string,
  serverDataDir: string
): Promise<{ filename: string; slug: string; version_number: string; success: boolean; error?: string }> {
  try {
    const res = await fetch(`${MODRINTH_API}/version/${versionId}`);
    if (!res.ok) throw new Error("Version not found");
    const version: ModrinthVersion = await res.json();

    if (!version.files || version.files.length === 0) {
      throw new Error("No files available for this version");
    }

    const file = version.files[0];
    const modsDir = join(serverDataDir, "mods");
    if (!existsSync(modsDir)) {
      mkdirSync(modsDir, { recursive: true });
    }

    const fileRes = await fetch(file.url);
    if (!fileRes.ok) throw new Error("Failed to download file");

    const buffer = Buffer.from(await fileRes.arrayBuffer());
    const filePath = join(modsDir, file.filename);
    writeFileSync(filePath, buffer);

    return { filename: file.filename, slug: version.project_id, version_number: version.version_number, success: true };
  } catch (err: unknown) {
    return { filename: "", slug: "", version_number: "", success: false, error: (err as Error).message };
  }
}
