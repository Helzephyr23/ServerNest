import type { NextConfig } from "next";

const API_HOST = process.env.API_HOST || "localhost";
const API_PORT = process.env.API_PORT || "3001";
const isProduction = process.env.NODE_ENV === "production";

// CSP is applied only in production. In dev mode, Next.js injects inline scripts for
// Webpack HMR ("__webpack_hmr", React Refresh) which would be blocked by script-src 'self',
// breaking hot reload entirely. This is intentional — not an oversight.
//
// 'unsafe-inline' in style-src is required by Next.js CSS modules and shadcn/ui components
// which use inline style props. Removing it would silently break layouts.
const cspValue = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "font-src 'self' data:",
].join("; ");

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    middlewareClientMaxBodySize: "100mb",
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `http://${API_HOST}:${API_PORT}/api/:path*`,
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
          { key: "Content-Security-Policy", value: cspValue },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
