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
