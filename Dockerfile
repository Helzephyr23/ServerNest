ARG PNPM_VERSION=9.15.0

# Stage 1: Build API
FROM node:20-alpine AS build-api
ARG PNPM_VERSION
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY src/package.json ./src/
COPY web/package.json ./web/
COPY agent/package.json ./agent/
RUN pnpm install --frozen-lockfile
# Explicit copy for the same reason as build-web: never blanket-copy a package
# directory, or the host's node_modules Junctions come along for the ride.
COPY src/tsconfig.json src/index.ts ./src/
COPY src/config ./src/config
COPY src/middleware ./src/middleware
COPY src/routes ./src/routes
COPY src/services ./src/services
COPY src/utils ./src/utils
COPY src/types ./src/types
COPY src/@types ./src/@types
RUN pnpm --filter @servernest/api exec tsc

# Stage 2: Build Frontend
FROM node:20-alpine AS build-web
ARG PNPM_VERSION
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY src/package.json ./src/
COPY web/package.json ./web/
COPY agent/package.json ./agent/
RUN pnpm install --frozen-lockfile
ENV NEXT_TELEMETRY_DISABLED=1
# The /api and /socket.io proxy targets are resolved in next.config.ts at BUILD
# time, not at container start: Next serializes the rewrites() result into
# .next/routes-manifest.json during `next build`. Runtime env vars cannot fix a
# rewrite that was already baked in, so API_HOST/API_PORT must be supplied as
# build args (see docker-compose.yml). Left unset, they default to 127.0.0.1
# and the panel 500s with "connect ECONNREFUSED 127.0.0.1:3001" on every /api
# call even though the API container is healthy on the same network.
ARG API_HOST=api
ARG API_PORT=3001
ENV API_HOST=${API_HOST}
ENV API_PORT=${API_PORT}
WORKDIR /app/web
# Copy only what `next build` needs. Do NOT use `COPY web/ ./web/` here: the
# host's web/node_modules contains Windows junctions, and a blanket copy drags
# them into the image. They overwrite pnpm's correct relative symlinks with
# absolute C:/Users/... paths that dangle on Linux, which surfaces as
# "Module not found" for a seemingly random subset of packages. The explicit
# list below also keeps .next/, test-results/, e2e/, and .env* out of both the
# context and the layer cache.
# NOTE: relative to /app/web, so each path must land inside the web package.
COPY web/app ./app
COPY web/lib ./lib
COPY web/components ./components
COPY web/public ./public
COPY web/next.config.ts web/tsconfig.json web/postcss.config.js web/tailwind.config.ts web/next-env.d.ts ./
ENV NODE_ENV=production
RUN pnpm exec next build && ls -la .next/standalone/

# Stage 3: API runtime
FROM node:20-alpine AS api-runtime
ARG PNPM_VERSION
RUN apk add --no-cache docker-cli curl
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
RUN addgroup -S servernest && adduser -S servernest -G servernest
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY src/package.json ./src/
COPY web/package.json ./web/
COPY agent/package.json ./agent/
RUN pnpm install --frozen-lockfile --prod
COPY --from=build-api /app/src/dist ./src/dist
RUN mkdir -p /app/data && chown -R servernest:servernest /app
USER servernest
EXPOSE 3001 25565-25665
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3001/api/health || exit 1
CMD ["node", "src/dist/index.js"]

# Stage 4: Web runtime
FROM node:20-alpine AS web-runtime
# curl is required by the HEALTHCHECK below. It was missing here, so the check
# failed with "curl: not found" and the container sat permanently unhealthy
# while still serving traffic correctly.
RUN apk add --no-cache curl
RUN addgroup -S servernest && adduser -S servernest -G servernest
# Next's standalone server binds to `process.env.HOSTNAME || "0.0.0.0"`, and
# Docker always sets HOSTNAME to the container ID. The server therefore bound
# only to the container's own IP: the published port worked from the host, but
# nothing inside the container could reach it over localhost, so the healthcheck
# failed with "curl: (7) Failed to connect to localhost:3000". Pin it.
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
WORKDIR /app
# Deliberately NO `pnpm install` in this stage. The Next standalone bundle is
# already fully self-contained, and installing the workspace on top of it is
# actively harmful rather than merely redundant: `next` is a devDependency, so
# `pnpm install --prod` plants a DANGLING symlink at /app/node_modules/next,
# which then prevents Docker's COPY from writing the real traced package into
# that same path. server.js then dies with "Cannot find module 'next'".
# The standalone trace is built in build-web, which does install normally.
# This is a pnpm workspace, and next.config.ts sets outputFileTracingRoot to
# the workspace root, so the standalone bundle mirrors the repo layout: the app
# lives at standalone/web/server.js and the traced store at
# standalone/node_modules/.pnpm. Copy the whole tree so those relative symlinks
# (web/node_modules/next -> ../../node_modules/.pnpm/next@.../next) keep
# resolving, and start the app from the nested path. Copying only
# standalone/web/ flattens the tree by one level, which turns every one of
# those symlinks into a dangling "../../node_modules/..." and yields
# "Cannot find module 'next'".
COPY --from=build-web /app/web/.next/standalone ./
COPY --from=build-web /app/web/.next/static ./web/.next/static
RUN chown -R servernest:servernest /app
USER servernest
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/ || exit 1
CMD ["node", "web/server.js"]
