import { describe, it, expect } from "vitest";
import { getTemplate, getAllTemplates } from "../../services/template.service.js";

describe("template.service", () => {
  describe("getAllTemplates", () => {
    it("should return 11 templates", () => {
      const templates = getAllTemplates();
      expect(templates.length).toBe(11);
    });

    it("should include all expected software types", () => {
      const templates = getAllTemplates();
      const ids = templates.map((t) => t.id);
      expect(ids).toContain("vanilla");
      expect(ids).toContain("paper");
      expect(ids).toContain("spigot");
      expect(ids).toContain("purpur");
      expect(ids).toContain("forge");
      expect(ids).toContain("fabric");
      expect(ids).toContain("neoforge");
      expect(ids).toContain("bedrock");
      expect(ids).toContain("sponge");
      expect(ids).toContain("bungeecord");
      expect(ids).toContain("velocity");
    });

    it("each template should have required fields", () => {
      for (const t of getAllTemplates()) {
        expect(t).toHaveProperty("id");
        expect(t).toHaveProperty("name");
        expect(t).toHaveProperty("description");
        expect(t).toHaveProperty("software");
        expect(t).toHaveProperty("image");
        expect(t).toHaveProperty("default_ram_mb");
        expect(t).toHaveProperty("env");
        expect(typeof t.id).toBe("string");
        expect(typeof t.name).toBe("string");
        expect(typeof t.software).toBe("string");
        expect(typeof t.image).toBe("string");
        expect(typeof t.default_ram_mb).toBe("number");
      }
    });
  });

  describe("getTemplate", () => {
    it("should return template by id", () => {
      const paper = getTemplate("paper");
      expect(paper).toBeDefined();
      expect(paper!.name).toBe("Paper");
      expect(paper!.software).toBe("paper");
    });

    it("should return undefined for non-existent template", () => {
      expect(getTemplate("nonexistent")).toBeUndefined();
    });

    it("should return bedrock with correct image", () => {
      const bedrock = getTemplate("bedrock");
      expect(bedrock!.image).toBe("itzg/minecraft-bedrock-server");
    });
  });
});
