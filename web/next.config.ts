import path from "node:path";
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
  // Required for the standalone output to work in this pnpm workspace. Without
  // it, Next traces only the `web` package dir, so it never follows pnpm's
  // `web/node_modules/<pkg> -> ../../node_modules/.pnpm/...` symlinks out into
  // the workspace root. The bundle then ships dangling `next`/`react`
  // symlinks and the server dies with "Cannot find module 'next'". Pointing the
  // tracing root at the workspace root (the parent of `web`, where
  // pnpm-workspace.yaml and the store live) makes the trace self-contained.
  // This is why .next/standalone nests the app at standalone/web/server.js
  // rather than standalone/server.js.
  outputFileTracingRoot: path.join(__dirname, ".."),
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
