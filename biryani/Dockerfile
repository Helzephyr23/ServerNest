FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Copy root config
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY .env.example ./.env.example

# Copy all package.json files
COPY src/package.json ./src/
COPY web/package.json ./web/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY src/ ./src/
COPY web/ ./web/

# Build API
WORKDIR /app/src
RUN pnpm build

# Build Frontend
WORKDIR /app/web
RUN pnpm build

WORKDIR /app

# Create data directory
RUN mkdir -p /app/data

EXPOSE 3000 3001

CMD ["sh", "-c", "node src/dist/index.js & npx next start web -p 3000 & wait"]
