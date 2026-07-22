ARG PNPM_VERSION=9.15.0

# Stage 1: Build API
FROM node:20-alpine AS build-api
ARG PNPM_VERSION
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY src/package.json ./src/
RUN pnpm install --frozen-lockfile
COPY src/ ./src/
RUN pnpm --filter @biryani/api exec tsc

# Stage 2: Build Frontend
FROM node:20-alpine AS build-web
ARG PNPM_VERSION
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY web/package.json ./web/
RUN pnpm install --frozen-lockfile
COPY web/ ./web/
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_API_URL=http://127.0.0.1:3001
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
WORKDIR /app/web
ENV NODE_ENV=production
RUN NEXT_BIN=$(find /app/node_modules/.pnpm -type f -path "*/next/dist/bin/next" 2>/dev/null | head -1) && \
    echo "next binary: $NEXT_BIN" && \
    ln -sf "$NEXT_BIN" /app/web/node_modules/.bin/next && \
    npx next build && ls -la .next/standalone/

# Stage 3: API runtime
FROM node:20-alpine AS api-runtime
ARG PNPM_VERSION
RUN apk add --no-cache docker-cli curl
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
RUN addgroup -S biryani && adduser -S biryani -G biryani
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY src/package.json ./src/
RUN pnpm install --frozen-lockfile --prod
COPY --from=build-api /app/src/dist ./src/dist
RUN mkdir -p /app/data && chown -R biryani:biryani /app
USER biryani
EXPOSE 3001 25565-25665
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3001/api/health || exit 1
CMD ["node", "src/dist/index.js"]

# Stage 4: Web runtime
FROM node:20-alpine AS web-runtime
ARG PNPM_VERSION
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
RUN addgroup -S biryani && adduser -S biryani -G biryani
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY web/package.json ./web/
RUN pnpm install --frozen-lockfile --prod
COPY --from=build-web /app/web/.next/standalone ./
COPY --from=build-web /app/web/.next/static ./.next/static
RUN chown -R biryani:biryani /app
USER biryani
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/ || exit 1
CMD ["node", "server.js"]
