import { describe, it, expect } from "vitest";

const { validate, validateQuery, schemas } = await import("../../middleware/validate.js");

function makeReply() {
  return {
    statusCode: 0,
    body: undefined as any,
    status(code: number) {
      this.statusCode = code;
      return {
        send: (payload: unknown) => {
          this.body = payload;
          return this;
        },
      };
    },
  };
}

describe("validate middleware", () => {
  it("rejects an invalid body with 400 and a Validation failed message", async () => {
    const mw = validate(schemas.login);
    const reply = makeReply();
    await mw({ body: { password: "x" } } as any, reply as any);
    expect(reply.statusCode).toBe(400);
    expect(reply.body.error).toContain("Validation failed");
    expect(reply.body.error).toContain("username");
  });

  it("replaces request.body with parsed data including schema defaults", async () => {
    const mw = validate(schemas.createServer);
    const request = { body: { name: "survival", mc_version: "1.21.4", eula_accepted: true } };
    await mw(request as any, makeReply() as any);
    expect(request.body).toMatchObject({
      name: "survival",
      mc_version: "1.21.4",
      software: "vanilla",
      ram_mb: 2048,
      eula_accepted: true,
    });
  });

  it("joins multiple validation issues into one message", async () => {
    const mw = validate(schemas.login);
    const reply = makeReply();
    await mw({ body: {} } as any, reply as any);
    expect(reply.body.error).toContain("username");
    expect(reply.body.error).toContain("password");
    expect(reply.body.error).toContain(", ");
  });

  it("surfaces custom refinement messages", async () => {
    const mw = validate(schemas.createServer);
    const reply = makeReply();
    await mw({ body: { name: "x", mc_version: "1.21.4", eula_accepted: false } } as any, reply as any);
    expect(reply.statusCode).toBe(400);
    expect(reply.body.error).toContain("You must accept the Minecraft EULA");
  });

  it("reports array element paths with dot notation", async () => {
    const mw = validate(schemas.installModsBatch);
    const reply = makeReply();
    await mw({ body: { versionIds: ["valid-id", ""] } } as any, reply as any);
    expect(reply.statusCode).toBe(400);
    expect(reply.body.error).toContain("versionIds.1");
  });
});

describe("validateQuery middleware", () => {
  it("coerces and replaces query values per the schema", async () => {
    const mw = validateQuery(schemas.serverLogsQuery);
    const request = { query: { tail: "50" } };
    await mw(request as any, makeReply() as any);
    expect(request.query).toEqual({ tail: 50 });
  });

  it("applies defaults to queries", async () => {
    const mw = validateQuery(schemas.serverLogsQuery);
    const request = { query: {} };
    await mw(request as any, makeReply() as any);
    expect(request.query).toEqual({ tail: 100 });
  });

  it("rejects invalid query values with 400", async () => {
    const mw = validateQuery(schemas.metricsHistoryQuery);
    const reply = makeReply();
    await mw({ query: { range: "30d" } } as any, reply as any);
    expect(reply.statusCode).toBe(400);
    expect(reply.body.error).toContain("Validation failed");
    expect(reply.body.error).toContain("range");
  });
});
