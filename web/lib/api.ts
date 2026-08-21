const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
const TIMEOUT_MS = 15000;

async function request<T>(method: string, path: string, body?: any): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: "include",
      signal: controller.signal,
    });
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") throw new Error("Request timed out");
    throw new Error("Network error");
  }
  clearTimeout(timeoutId);

  if (res.status === 401 && typeof window !== "undefined" && window.location.pathname !== "/login") {
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }

  let data: any;
  let text = "";
  try {
    text = await res.text();
    data = JSON.parse(text);
  } catch {
    throw new Error(`Unexpected response (${res.status}): ${text.slice(0, 200)}`);
  }

  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

async function uploadFile<T>(path: string, file: File): Promise<T> {
  const formData = new FormData();
  formData.append("file", file);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      body: formData,
      credentials: "include",
      signal: controller.signal,
    });
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") throw new Error("Upload timed out");
    throw new Error("Network error during upload");
  }
  clearTimeout(timeoutId);

  if (res.status === 401 && typeof window !== "undefined" && window.location.pathname !== "/login") {
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }

  let data: any;
  try {
    data = await res.json();
  } catch {
    throw new Error(`Upload failed (${res.status})`);
  }

  if (!res.ok) throw new Error(data.error || "Upload failed");
  return data;
}

export const api = {
  get: <T = any>(path: string) => request<T>("GET", path),
  post: <T = any>(path: string, body?: any) => request<T>("POST", path, body),
  put: <T = any>(path: string, body?: any) => request<T>("PUT", path, body),
  delete: <T = any>(path: string) => request<T>("DELETE", path),
  upload: <T = any>(path: string, file: File) => uploadFile<T>(path, file),
};
