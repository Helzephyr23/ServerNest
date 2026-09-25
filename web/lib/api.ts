// All REST calls are same-origin: the Next.js server proxies /api/* to the
// Fastify API (see next.config.ts rewrites). This keeps cookies first-party
// so the panel works from any host (localhost, LAN IP, Tailscale, etc.).
const TIMEOUT_MS = 15000;
const TOKEN_KEY = "biryani_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(TOKEN_KEY, token);
    document.cookie = `${TOKEN_KEY}=${token}; path=/; max-age=86400; SameSite=None; Secure`;
  } catch {}
}

export function clearToken() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(TOKEN_KEY);
    document.cookie = `${TOKEN_KEY}=; path=/; max-age=0; SameSite=None; Secure`;
  } catch {}
}

async function request<T>(method: string, path: string, body?: any): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const token = getToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(path, {
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

  if (res.status === 401 && typeof window !== "undefined" && window.location.pathname !== "/login" && window.location.pathname !== "/setup") {
    clearToken();
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

  if (data?.token && typeof data.token === "string") {
    setToken(data.token);
  }

  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

async function uploadFile<T>(path: string, file: File): Promise<T> {
  const formData = new FormData();
  formData.append("file", file);

  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000);

  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      headers,
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

  if (res.status === 401 && typeof window !== "undefined" && window.location.pathname !== "/login" && window.location.pathname !== "/setup") {
    clearToken();
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
