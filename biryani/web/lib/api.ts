const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3001";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("biryani_token");
}

async function request<T>(method: string, path: string, body?: any): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && typeof window !== "undefined" && window.location.pathname !== "/login") {
    localStorage.removeItem("biryani_token");
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export const api = {
  get: <T = any>(path: string) => request<T>("GET", path),
  post: <T = any>(path: string, body?: any) => request<T>("POST", path, body),
  put: <T = any>(path: string, body?: any) => request<T>("PUT", path, body),
  delete: <T = any>(path: string) => request<T>("DELETE", path),
};
