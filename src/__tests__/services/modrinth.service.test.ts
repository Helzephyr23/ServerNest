import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { mkdtempSync, existsSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

const { searchMods, searchPlugins, getProject, getProjectVersions, downloadMod } = await import(
  "../../services/modrinth.service.js"
);

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

let tempDir: string;

function makeTempDir(): string {
  tempDir = mkdtempSync(join(tmpdir(), "modrinth-test-"));
  return tempDir;
}

afterEach(() => {
  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true });
    tempDir = undefined as unknown as string;
  }
});

describe("searchMods", () => {
  it("queries the modrinth search endpoint with mod facets", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { hits: [{ slug: "sodium" }] }));
    const hits = await searchMods("sodium");
    expect(hits).toEqual([{ slug: "sodium" }]);
    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.pathname).toBe("/v2/search");
    expect(url.searchParams.get("query")).toBe("sodium");
    expect(url.searchParams.get("limit")).toBe("20");
    const facets = JSON.parse(url.searchParams.get("facets")!);
    expect(facets).toContainEqual(["project_type:mod"]);
    expect(facets).toContainEqual(["server_side:required", "server_side:optional"]);
  });

  it("adds version and loader facets when provided", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { hits: [] }));
    await searchMods("jei", "1.21.4", "fabric", 5);
    const url = new URL(fetchMock.mock.calls[0][0] as string);
    const facets = JSON.parse(url.searchParams.get("facets")!);
    expect(facets).toContainEqual(["versions:1.21.4"]);
    expect(facets).toContainEqual(["categories:fabric"]);
    expect(url.searchParams.get("limit")).toBe("5");
  });

  it("returns an empty array when there are no hits", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {}));
    expect(await searchMods("nothing-matches")).toEqual([]);
  });
});

describe("searchPlugins", () => {
  it("queries with plugin project type and optional version facet", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { hits: [{ slug: "luckperms" }] }));
    const hits = await searchPlugins("luck", "1.21.4");
    expect(hits).toHaveLength(1);
    const url = new URL(fetchMock.mock.calls[0][0] as string);
    const facets = JSON.parse(url.searchParams.get("facets")!);
    expect(facets).toContainEqual(["project_type:plugin"]);
    expect(facets).toContainEqual(["versions:1.21.4"]);
  });
});

describe("getProject", () => {
  it("returns project data on success", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { slug: "sodium", title: "Sodium" }));
    const project = await getProject("sodium");
    expect(project.title).toBe("Sodium");
    expect((fetchMock.mock.calls[0][0] as string)).toContain("/v2/project/sodium");
  });

  it("throws for a missing project", async () => {
    fetchMock.mockResolvedValue(jsonResponse(404, { error: "not found" }));
    await expect(getProject("nope")).rejects.toThrow("Project not found");
  });
});

describe("getProjectVersions", () => {
  it("fetches versions without filters by default", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, [{ id: "v1" }]));
    const versions = await getProjectVersions("sodium");
    expect(versions).toEqual([{ id: "v1" }]);
    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.searchParams.get("game_versions")).toBeNull();
  });

  it("encodes game version and loader filters as JSON params", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, []));
    await getProjectVersions("sodium", "1.21.4", "fabric");
    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(JSON.parse(url.searchParams.get("game_versions")!)).toEqual(["1.21.4"]);
    expect(JSON.parse(url.searchParams.get("loaders")!)).toEqual(["fabric"]);
  });
});

describe("downloadMod", () => {
  function mockVersionFetch(files: unknown) {
    fetchMock.mockImplementation(async (url: string) => {
      if ((url as string).includes("/version/ver-1")) {
        return jsonResponse(200, {
          id: "ver-1",
          project_id: "proj-1",
          version_number: "1.0.0",
          files,
        });
      }
      return new Response(Buffer.from("jar-bytes"));
    });
  }

  it("downloads the first file into the server's mods directory", async () => {
    const dir = makeTempDir();
    mockVersionFetch([{ url: "https://cdn.modrinth.com/file.jar", filename: "coolmod-1.0.jar", size: 9 }]);
    const result = await downloadMod("ver-1", dir);
    expect(result).toMatchObject({ filename: "coolmod-1.0.jar", slug: "proj-1", version_number: "1.0.0", success: true });
    expect(existsSync(join(dir, "mods", "coolmod-1.0.jar"))).toBe(true);
    expect(readFileSync(join(dir, "mods", "coolmod-1.0.jar"), "utf-8")).toBe("jar-bytes");
  });

  it("reports failure when the version does not exist", async () => {
    makeTempDir();
    fetchMock.mockResolvedValue(jsonResponse(404, {}));
    const result = await downloadMod("missing", tempDir);
    expect(result.success).toBe(false);
    expect(result.error).toBe("Version not found");
  });

  it("reports failure when the version has no files", async () => {
    makeTempDir();
    mockVersionFetch([]);
    const result = await downloadMod("ver-1", tempDir);
    expect(result.success).toBe(false);
    expect(result.error).toBe("No files available for this version");
  });

  it("reports failure when the file download fails", async () => {
    makeTempDir();
    fetchMock.mockImplementation(async (url: string) => {
      if ((url as string).includes("/version/ver-1")) {
        return jsonResponse(200, { id: "ver-1", project_id: "p", version_number: "1", files: [{ url: "https://cdn/x.jar", filename: "x.jar", size: 1 }] });
      }
      return jsonResponse(500, {});
    });
    const result = await downloadMod("ver-1", tempDir);
    expect(result.success).toBe(false);
    expect(result.error).toBe("Failed to download file");
  });
});
