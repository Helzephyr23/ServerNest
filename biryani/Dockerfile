# Stage 1: Install dependencies
FROM node:20-alpine AS deps
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY src/package.json ./src/
COPY web/package.json ./web/
RUN pnpm install --frozen-lockfile

# Stage 2: Build API
FROM deps AS build-api
WORKDIR /app/src
COPY src/ ./
RUN pnpm build

# Stage 3: Build Frontend
FROM deps AS build-web
ARG CACHEBUST=1
WORKDIR /app/web
COPY web/ ./
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ARG NEXT_PUBLIC_API_URL=http://127.0.0.1:3001
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npx next build && ls -la .next/standalone/

# Stage 4: Production runtime
FROM node:20-alpine AS runtime
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

RUN apk add --no-cache docker-cli curl

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY src/package.json ./src/
COPY web/package.json ./web/
RUN pnpm install --frozen-lockfile --prod

COPY --from=build-api /app/src/dist ./src/dist
COPY --from=build-web /app/web/.next/standalone ./web-standalone/
COPY --from=build-web /app/web/.next/static ./web-standalone/.next/static
RUN mkdir -p /app/data

EXPOSE 3000 3001 25565-25665

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3001/api/health || exit 1

CMD ["sh", "-c", "node src/dist/index.js & node web-standalone/server.js & wait"]
