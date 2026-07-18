const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
const TIMEOUT_MS = 15000;

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("biryani_token");
}

async function request<T>(method: string, path: string, body?: any): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") throw new Error("Request timed out");
    throw new Error("Network error");
  }
  clearTimeout(timeoutId);

  if (res.status === 401 && typeof window !== "undefined" && window.location.pathname !== "/login") {
    localStorage.removeItem("biryani_token");
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }

  let data: any;
  let text: string;
  try {
    text = await res.text();
    data = JSON.parse(text);
  } catch {
    throw new Error(`Unexpected response (${res.status}): ${(text || "").slice(0, 200)}`);
  }

  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export const api = {
  get: <T = any>(path: string) => request<T>("GET", path),
  post: <T = any>(path: string, body?: any) => request<T>("POST", path, body),
  put: <T = any>(path: string, body?: any) => request<T>("PUT", path, body),
  delete: <T = any>(path: string) => request<T>("DELETE", path),
};
