import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

const raw = readFileSync(path.resolve(__dirname, "../../../docker-compose.yml"), "utf8");

/** Compose minus comment lines, so explanatory comments cannot mask a real mapping. */
const effective = raw
  .split("\n")
  .filter((line) => !line.trim().startsWith("#"))
  .join("\n");

/**
 * Collect the entries of every `ports:` block, e.g. for
 *
 *     ports:
 *       - "${PANEL_PORT}:3001"
 *
 * returns ['"${PANEL_PORT}:3001"'].
 */
function publishedPortEntries(yaml: string): string[] {
  const entries: string[] = [];
  const lines = yaml.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (!/^\s*ports:\s*$/.test(lines[i])) continue;
    const portIndent = lines[i].match(/^\s*/)![0].length;
    for (let j = i + 1; j < lines.length; j++) {
      const line = lines[j];
      if (line.trim() === "") continue;
      const indent = line.match(/^\s*/)![0].length;
      // A non-entry, less-indented line ends the block.
      if (indent <= portIndent) break;
      if (/^\s*-\s/.test(line)) entries.push(line.trim());
    }
  }
  return entries;
}

/**
 * Guard against a bug that shipped once already.
 *
 * The api service used to publish the whole Minecraft port range on the host:
 *
 *     - "${SERVER_PORT_RANGE_START:-25565}-${SERVER_PORT_RANGE_END:-25665}:25565-25665"
 *
 * That reserved all 101 ports the panel allocates from, while
 * findAvailablePort() only consulted the database and so handed out ports the
 * daemon had already taken. Every server then failed at container.start() with
 * "port is already allocated", surfacing as a bare 500 on /start.
 *
 * Minecraft containers are created on the host daemon with their own host port
 * bindings, so the panel containers have no reason to publish that range. This
 * test makes re-adding it a deliberate act rather than an accident.
 */
describe("docker-compose.yml", () => {
  it("does not publish the Minecraft port range from any container", () => {
    const offending = publishedPortEntries(effective).filter((e) => e.includes("SERVER_PORT_RANGE"));
    expect(offending).toEqual([]);
  });

  it("does not hardcode the 25565-25665 range in any port mapping", () => {
    const offending = publishedPortEntries(effective).filter((e) => /25565-25665/.test(e));
    expect(offending).toEqual([]);
  });

  it("still publishes the panel ports", () => {
    // Sanity check: the guard must not pass simply because port parsing broke.
    const entries = publishedPortEntries(effective);
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.join("\n")).toContain("PANEL_PORT");
  });

  /**
   * The panel hands ${SERVER_DATA_DIR}/server-<id> to Docker as a bind source,
   * which the daemon resolves on the host. If the container target differed from
   * the host source, every panel-side write -- mod install, file upload, server
   * import, clone, restore snapshot -- would silently target a directory the
   * Minecraft container never mounts.
   */
  it("mounts SERVER_DATA_DIR at an identical source and target", () => {
    const bind = effective
      .split("\n")
      .filter((line) => !line.trim().startsWith("#"))
      .join("\n")
      .match(
        /type: bind\s*\n\s*source: \$\{SERVER_DATA_DIR[^}]*\}\s*\n\s*target: \$\{SERVER_DATA_DIR[^}]*\}/,
      );

    expect(bind).not.toBeNull();
  });
});
