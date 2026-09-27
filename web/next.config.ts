import type { NextConfig } from "next";

const API_HOST = process.env.API_HOST || "127.0.0.1";
const API_PORT = process.env.API_PORT || "3001";
const isProduction = process.env.NODE_ENV === "production";
const ALLOWED_DEV_ORIGINS = (process.env.ALLOWED_DEV_ORIGINS || "**.ts.net")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    middlewareClientMaxBodySize: "100mb",
  },
  ...(isProduction
    ? {}
    : {
        // Allow reaching the dev server through Tailscale funnel (and other
        // public origins) without Next's cross-origin protection blocking
        // /_next/* chunks. See "allowedDevOrigins" in the Next.js docs.
        allowedDevOrigins: ALLOWED_DEV_ORIGINS,
      }),
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `http://${API_HOST}:${API_PORT}/api/:path*`,
      },
      {
        source: "/socket.io",
        destination: `http://${API_HOST}:${API_PORT}/socket.io/`,
      },
      {
        source: "/socket.io/:path*",
        destination: `http://${API_HOST}:${API_PORT}/socket.io/:path*`,
      },
    ];
  },
  async headers() {
    if (!isProduction) return [];
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
