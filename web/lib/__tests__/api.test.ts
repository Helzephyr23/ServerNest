import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../api";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  fetchMock.mockReset();
});

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function textResponse(status: number, text: string): Response {
  return new Response(text, { status });
}

function stubWindow(pathname: string) {
  const location = { href: "", pathname };
  vi.stubGlobal("window", { location });
  return location;
}

describe("api wrapper", () => {
  it("performs GET without content-type or body", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { hello: "world" }));
    const data = await api.get("/things");
    expect(data).toEqual({ hello: "world" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/things");
    expect(init.method).toBe("GET");
    expect(init.headers).toEqual({});
    expect(init.body).toBeUndefined();
    expect(init.credentials).toBe("include");
  });

  it("serializes JSON bodies on POST", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { id: 1 }));
    await api.post("/things", { name: "test" });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
    expect(init.body).toBe(JSON.stringify({ name: "test" }));
  });

  it("supports PUT and DELETE verbs", async () => {
    fetchMock.mockImplementation(async () => jsonResponse(200, {}));
    await api.put("/things/1", { a: 1 });
    await api.delete("/things/1");
    expect(fetchMock.mock.calls[0][1].method).toBe("PUT");
    expect(fetchMock.mock.calls[1][1].method).toBe("DELETE");
  });

  it("surfaces server-provided error messages", async () => {
    fetchMock.mockResolvedValue(jsonResponse(400, { error: "Invalid input" }));
    await expect(api.post("/things", {})).rejects.toThrow("Invalid input");
  });

  it("falls back to a generic message when no error field exists", async () => {
    fetchMock.mockResolvedValue(jsonResponse(500, { detail: "boom" }));
    await expect(api.get("/things")).rejects.toThrow("Request failed");
  });

  it("reports unexpected non-JSON responses with status and snippet", async () => {
    fetchMock.mockResolvedValue(textResponse(502, "<html>bad gateway</html>"));
    await expect(api.get("/things")).rejects.toThrow(/Unexpected response \(502\)/);
  });

  it("redirects to /login on 401 when not already there", async () => {
    const location = stubWindow("/dashboard");
    fetchMock.mockResolvedValue(jsonResponse(401, {}));
    await expect(api.get("/things")).rejects.toThrow("Unauthorized");
    expect(location.href).toBe("/login");
  });

  it("does not redirect when the 401 comes from the login page itself", async () => {
    const location = stubWindow("/login");
    fetchMock.mockResolvedValue(jsonResponse(401, {}));
    await expect(api.get("/things")).rejects.toThrow("Request failed");
    expect(location.href).toBe("");
  });

  it("maps network failures to a friendly message", async () => {
    stubWindow("/dashboard");
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    await expect(api.get("/things")).rejects.toThrow("Network error");
  });

  it("maps request aborts to a timeout message", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal.addEventListener("abort", () => {
            const err = new Error("The operation was aborted");
            err.name = "AbortError";
            reject(err);
          });
        })
    );
    const pending = api.get("/slow");
    const assertion = expect(pending).rejects.toThrow("Request timed out");
    await vi.advanceTimersByTimeAsync(15000);
    await assertion;
  });

  describe("uploads", () => {
    function makeFile(): File {
      return new File(["file-content"], "world.zip", { type: "application/zip" });
    }

    it("posts multipart form data with credentials", async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, { url: "/backups/x" }));
      const data = await api.upload("/upload", makeFile());
      expect(data).toEqual({ url: "/backups/x" });
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("/upload");
      expect(init.method).toBe("POST");
      expect(init.body).toBeInstanceOf(FormData);
      expect(init.body.get("file")).toBeInstanceOf(File);
      expect(init.credentials).toBe("include");
    });

    it("surfaces upload error messages from the server", async () => {
      fetchMock.mockResolvedValue(jsonResponse(413, { error: "File too large" }));
      await expect(api.upload("/upload", makeFile())).rejects.toThrow("File too large");
    });

    it("reports non-JSON upload failures with status", async () => {
      fetchMock.mockResolvedValue(textResponse(502, "gateway junk"));
      await expect(api.upload("/upload", makeFile())).rejects.toThrow("Upload failed (502)");
    });

    it("maps upload network failures to a friendly message", async () => {
      stubWindow("/dashboard");
      fetchMock.mockRejectedValue(new TypeError("fetch failed"));
      await expect(api.upload("/upload", makeFile())).rejects.toThrow("Network error during upload");
    });

    it("maps upload aborts to an upload timeout message", async () => {
      vi.useFakeTimers();
      fetchMock.mockImplementation(
        (_url: string, init: { signal: AbortSignal }) =>
          new Promise<Response>((_resolve, reject) => {
            init.signal.addEventListener("abort", () => {
              const err = new Error("The operation was aborted");
              err.name = "AbortError";
              reject(err);
            });
          })
      );
      const pending = api.upload("/upload", makeFile());
      const assertion = expect(pending).rejects.toThrow("Upload timed out");
      await vi.advanceTimersByTimeAsync(120000);
      await assertion;
    });
  });
});
